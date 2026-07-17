export interface Env {
	COURSE_MEDIA: R2Bucket;
	MEDIA_INTERNAL_TOKEN: string;
}

type ParsedRange = { offset: number; length?: number } | { suffix: number };

function parseKey(url: URL) {
	// Декодируем pathname (он может содержать URL-encoded символы, например %2F для /)
	let decodedPathname: string;
	try {
		decodedPathname = decodeURIComponent(url.pathname);
	} catch {
		// Если декодирование не удалось, используем оригинальный pathname
		decodedPathname = url.pathname;
	}
	const p = decodedPathname.replace(/^\/+/, '');
	return p.startsWith('media/') ? p.slice('media/'.length) : p;
}

function parseHttpRange(rangeHeader: string | null): ParsedRange | null {
	if (!rangeHeader) return null;

	if (!rangeHeader.startsWith('bytes=')) throw new Error('Unsupported range unit');

	const spec = rangeHeader.slice('bytes='.length).trim();

	if (spec.includes(',')) throw new Error('Multipart ranges are not supported');

	const [startStr, endStr] = spec.split('-', 2);

	// suffix: bytes=-500
	if (startStr === '' && endStr) {
		const suffix = Number(endStr);
		if (!Number.isFinite(suffix) || suffix <= 0) throw new Error('Invalid suffix range');
		return { suffix };
	}

	// bytes=500- or bytes=500-999
	if (startStr !== '') {
		const offset = Number(startStr);
		if (!Number.isFinite(offset) || offset < 0) throw new Error('Invalid range offset');

		if (!endStr) return { offset }; // to end

		const end = Number(endStr);
		if (!Number.isFinite(end) || end < offset) throw new Error('Invalid range end');

		return { offset, length: end - offset + 1 };
	}

	throw new Error('Invalid range');
}

function computeStartEnd(total: number, pr: ParsedRange): { start: number; end: number } {
	if ('suffix' in pr) {
		const len = Math.min(pr.suffix, total);
		const start = Math.max(0, total - len);
		return { start, end: total - 1 };
	}

	const start = pr.offset;
	const end = pr.length ? Math.min(total - 1, start + pr.length - 1) : total - 1;
	return { start, end };
}

async function safeEqual(left: string, right: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [leftHash, rightHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(left)),
		crypto.subtle.digest('SHA-256', encoder.encode(right)),
	]);
	const leftBytes = new Uint8Array(leftHash);
	const rightBytes = new Uint8Array(rightHash);
	let difference = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		difference |= leftBytes[index] ^ rightBytes[index];
	}
	return difference === 0;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			return new Response('Метод не поддерживается', {
				status: 405,
				headers: { allow: 'GET, HEAD' },
			});
		}

		if (!env.MEDIA_INTERNAL_TOKEN) {
			return new Response('Служебная авторизация не настроена', { status: 503 });
		}
		const authorization = req.headers.get('authorization') ?? '';
		const [scheme, suppliedToken] = authorization.split(' ', 2);
		if (
			scheme?.toLowerCase() !== 'bearer' ||
			!suppliedToken ||
			!(await safeEqual(suppliedToken, env.MEDIA_INTERNAL_TOKEN))
		) {
			return new Response('Доступ запрещён', { status: 401 });
		}

		const url = new URL(req.url);
		let key = parseKey(url);

		if (!key) return new Response('Некорректный путь', { status: 400 });
		
		// Нормализуем ключ: убираем лишние слэши (parseKey уже убирает начальные)
		key = key.replace(/\/+$/, "");
		
		let pr: ParsedRange | null = null;
		try {
			pr = parseHttpRange(req.headers.get('range'));
		} catch {
			// Некорректный Range
			return new Response('Range Not Satisfiable', { status: 416 });
		}

		// parseKey уже возвращает декодированный ключ, используем его напрямую для R2
		const obj = await env.COURSE_MEDIA.get(key, pr ? { range: pr } : {});

		if (!obj) return new Response('Файл не найден', { status: 404 });

		if (!('body' in obj)) return new Response(null, { status: 412 });

		const total = Number(obj.size);
		if (!Number.isFinite(total) || total <= 0) {
			console.error('Некорректный размер объекта R2', { key, size: obj.size });
			return new Response('Некорректные метаданные файла', { status: 500 });
		}

		const headers = new Headers();
		obj.writeHttpMetadata(headers);
		headers.set('etag', obj.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', 'private, max-age=3600');

		// [Best Practice] иногда помогает убрать HTTP/3-переиспользование через Alt-Svc
		headers.set('alt-svc', 'clear');

		// Range response
		if (pr) {
			const { start, end } = computeStartEnd(total, pr);

			if (
				!Number.isFinite(start) ||
				!Number.isFinite(end) ||
				start < 0 ||
				end < start ||
				start >= total
			) {
				const h = new Headers(headers);
				h.set('content-range', `bytes */${total}`);
				return new Response('Range Not Satisfiable', { status: 416, headers: h });
			}

			const len = end - start + 1;

			headers.set('content-range', `bytes ${start}-${end}/${total}`);
			headers.set('content-length', String(len));

			// HEAD поддержи (полезно для дебага/плееров)
			if (req.method === 'HEAD') return new Response(null, { status: 206, headers });

			return new Response(obj.body, { status: 206, headers });
		}

		headers.set('content-length', String(total));

		if (req.method === 'HEAD') return new Response(null, { status: 200, headers });

		return new Response(obj.body, { status: 200, headers });
	},
};
