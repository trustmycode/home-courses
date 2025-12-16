import { MEDIA_WORKER_ORIGIN, MEDIA_PATH_PREFIX } from "@/lib/constants";

export const runtime = "edge";

function pick(req: Request, name: string, out: Headers) {
	const v = req.headers.get(name);
	if (v) out.set(name, v);
}

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ key: string[] }> }
) {
	const { key: keyArray } = await params;
	const key = keyArray.join("/");

	const upstream = `${MEDIA_WORKER_ORIGIN}${MEDIA_PATH_PREFIX}/${key}`;

	const h = new Headers();
	pick(req, "range", h);
	pick(req, "if-none-match", h);
	pick(req, "if-modified-since", h);
	pick(req, "if-match", h);
	pick(req, "if-unmodified-since", h);

	const res = await fetch(upstream, { method: "GET", headers: h });

	const out = new Headers();

	// пробрасываем важные для видео заголовки
	for (const name of [
		"content-type",
		"content-length",
		"content-range",
		"accept-ranges",
		"etag",
		"last-modified",
		"cache-control",
	]) {
		const v = res.headers.get(name);
		if (v) out.set(name, v);
	}

	return new Response(res.body, { status: res.status, headers: out });
}

export async function HEAD(
	req: Request,
	ctx: { params: Promise<{ key: string[] }> }
) {
	const r = await GET(req, ctx);
	return new Response(null, { status: r.status, headers: r.headers });
}

