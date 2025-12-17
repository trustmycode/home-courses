export interface Env {
	COURSE_MEDIA: R2Bucket;
	MEDIA_SIGNING_SECRET: string;
}

type ParsedRange = { offset: number; length?: number } | { suffix: number };

function parseKey(url: URL) {
	const p = url.pathname.replace(/^\/+/, '');
	return p.startsWith('media/') ? p.slice('media/'.length) : p;
}

function parseHttpRange(rangeHeader: string | null): ParsedRange | null {
	if (!rangeHeader) return null;

	if (!rangeHeader.startsWith('bytes=')) return null;

	const spec = rangeHeader.slice('bytes='.length).trim();

	if (spec.includes(',')) throw new Error('Multipart ranges are not supported');

	const [startStr, endStr] = spec.split('-', 2);

	// suffix: bytes=-500
	if (startStr === '' && endStr) {
		const suffix = Number(endStr);
		if (!Number.isFinite(suffix) || suffix <= 0) return null;
		return { suffix };
	}

	// bytes=500- or bytes=500-999
	if (startStr !== '') {
		const offset = Number(startStr);
		if (!Number.isFinite(offset) || offset < 0) return null;

		if (!endStr) return { offset }; // to end

		const end = Number(endStr);
		if (!Number.isFinite(end) || end < offset) return null;

		return { offset, length: end - offset + 1 };
	}

	return null;
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

/**
 * Проверяет HMAC-SHA256 подпись для медиа-файла
 * @param key - R2 ключ медиа-файла
 * @param exp - Unix timestamp истечения подписи
 * @param sig - Base64url-encoded подпись
 * @param secret - Секретный ключ для проверки
 * @returns true если подпись валидна, false иначе
 */
async function verify(key: string, exp: number, sig: string, secret: string): Promise<boolean> {
	const data = `${key}:${exp}`;
	const encoder = new TextEncoder();
	const keyBytes = encoder.encode(secret);
	const dataBytes = encoder.encode(data);
	
	// Декодируем base64url подпись
	const sigBytes = Uint8Array.from(
		atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
		c => c.charCodeAt(0)
	);
	
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"]
	);
	
	return crypto.subtle.verify("HMAC", cryptoKey, sigBytes, dataBytes);
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const key = parseKey(url);

		if (!key) return new Response('Bad Request', { status: 400 });

		// Проверка подписи (если секрет настроен)
		if (env.MEDIA_SIGNING_SECRET) {
			const expParam = url.searchParams.get("exp");
			const sigParam = url.searchParams.get("sig");
			
			if (!expParam || !sigParam) {
				return new Response('Missing signature parameters', { status: 403 });
			}
			
			const exp = parseInt(expParam, 10);
			const now = Math.floor(Date.now() / 1000);
			
			// Проверяем, не истекла ли подпись
			if (!Number.isFinite(exp) || now > exp) {
				return new Response('Link expired', { status: 403 });
			}
			
			// Проверяем подпись
			const isValid = await verify(key, exp, sigParam, env.MEDIA_SIGNING_SECRET);
			if (!isValid) {
				return new Response('Invalid signature', { status: 403 });
			}
		}

		let pr: ParsedRange | null = null;
		try {
			pr = parseHttpRange(req.headers.get('range'));
		} catch {
			// Некорректный Range
			return new Response('Range Not Satisfiable', { status: 416 });
		}

		// Берём объект (с range или без)
		const obj = await env.COURSE_MEDIA.get(key, pr ? { range: pr } : {});

		if (!obj) return new Response('Not Found', { status: 404 });

		if (!('body' in obj)) return new Response(null, { status: 412 });

		const total = Number(obj.size);
		if (!Number.isFinite(total) || total <= 0) {
			console.log('Bad obj.size', { key, size: obj.size });
			return new Response('Bad media metadata', { status: 500 });
		}

		const headers = new Headers();
		obj.writeHttpMetadata(headers);
		headers.set('etag', obj.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', 'private, max-age=300');

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

