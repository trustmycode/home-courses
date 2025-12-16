export interface Env {
	COURSE_MEDIA: R2Bucket;
}

type ParsedRange =
	| { offset: number; length?: number }
	| { offset?: number; length: number }
	| { suffix: number };

function parseKey(url: URL) {
	// будем принимать запросы вида:
	// /media/<r2Key>  или просто /<r2Key>
	const p = url.pathname.replace(/^\/+/, '');
	return p.startsWith('media/') ? p.slice('media/'.length) : p;
}

function parseHttpRange(rangeHeader: string | null): ParsedRange | null {
	if (!rangeHeader) return null;

	// bytes=0-1023 / bytes=0- / bytes=-500
	if (!rangeHeader.startsWith('bytes=')) return null;

	const spec = rangeHeader.slice('bytes='.length).trim();

	// multipart ranges не поддерживаем
	if (spec.includes(',')) throw new Error('Multipart ranges are not supported');

	const [startStr, endStr] = spec.split('-', 2);

	// suffix: "-500"
	if (startStr === '' && endStr) {
		const suffix = Number(endStr);
		if (!Number.isFinite(suffix) || suffix <= 0) return null;
		return { suffix };
	}

	// offset: "500-" или "500-999"
	if (startStr !== '') {
		const offset = Number(startStr);
		if (!Number.isFinite(offset) || offset < 0) return null;

		if (!endStr) return { offset }; // до конца файла

		const end = Number(endStr);
		if (!Number.isFinite(end) || end < offset) return null;

		return { offset, length: end - offset + 1 };
	}

	return null;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const key = parseKey(url);

		if (!key) return new Response('Bad Request', { status: 400 });

		let parsedRange: ParsedRange | null = null;
		try {
			parsedRange = parseHttpRange(req.headers.get('range'));
		} catch {
			return new Response('Range Not Satisfiable', { status: 416 });
		}

		const obj = await env.COURSE_MEDIA.get(
			key,
			parsedRange
				? { range: parsedRange, onlyIf: req.headers }
				: { onlyIf: req.headers }
		);

		if (obj === null) return new Response('Not Found', { status: 404 });

		if (!('body' in obj)) {
			const h = new Headers();
			obj.writeHttpMetadata(h);
			h.set('etag', obj.httpEtag);
			return new Response(null, { status: 412, headers: h });
		}

		const headers = new Headers();
		obj.writeHttpMetadata(headers);
		headers.set('etag', obj.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', 'private, max-age=300');

		// Если это Range-запрос — корректный 206 + Content-Range/Content-Length
		if (parsedRange) {
			const total = obj.size;

			let start = 0;
			let end = total - 1;

			if ('suffix' in parsedRange) {
				const len = Math.min(parsedRange.suffix, total);
				start = total - len;
				end = total - 1;
			} else {
				start = parsedRange.offset ?? 0;

				if (typeof parsedRange.length === 'number') {
					end = Math.min(total - 1, start + parsedRange.length - 1);
				} else {
					end = total - 1; // bytes=START-
				}
			}

			// Валидация на всякий случай
			if (
				!Number.isFinite(start) ||
				!Number.isFinite(end) ||
				start < 0 ||
				start >= total ||
				end < start
			) {
				headers.set('content-range', `bytes */${total}`);
				return new Response(null, { status: 416, headers });
			}

			const len = end - start + 1;

			headers.set('content-range', `bytes ${start}-${end}/${total}`);
			headers.set('content-length', String(len));

			return new Response(obj.body, { status: 206, headers });
		}

		headers.set('content-length', String(obj.size));
		return new Response(obj.body, { status: 200, headers });
	},
};

