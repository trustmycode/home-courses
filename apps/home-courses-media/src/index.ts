export interface Env {
	COURSE_MEDIA: R2Bucket;
}

function parseKey(url: URL) {
	// будем принимать запросы вида:
	// /media/<r2Key>  или просто /<r2Key>
	const p = url.pathname.replace(/^\/+/, '');
	return p.startsWith('media/') ? p.slice('media/'.length) : p;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const key = parseKey(url);

		if (!key) return new Response('Bad Request', { status: 400 });

		// Важно: Range/conditional headers пробрасываем напрямую
		const obj = await env.COURSE_MEDIA.get(key, {
			range: req.headers,
			onlyIf: req.headers,
		});

		if (obj === null) return new Response('Not Found', { status: 404 });

		const headers = new Headers();
		obj.writeHttpMetadata(headers);
		headers.set('etag', obj.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', 'private, max-age=300');

		// Если диапазон запрошен — отвечаем 206
		const isRange = req.headers.has('range');
		
		// Проверяем тип: R2ObjectBody имеет body, R2Object - нет
		if (!('body' in obj)) {
			// R2Object возвращается когда preconditions не проходят (304 Not Modified)
			return new Response(null, { status: 304, headers });
		}

		return new Response(obj.body, { status: isRange ? 206 : 200, headers });
	},
};
