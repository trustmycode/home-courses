import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	MEDIA_WORKER_ORIGIN,
	MEDIA_PATH_PREFIX,
	CF_ACCESS_CLIENT_ID_ENV,
	CF_ACCESS_CLIENT_SECRET_ENV,
} from "@/lib/constants";

function pick(req: Request, name: string, out: Headers) {
	const v = req.headers.get(name);
	if (v) out.set(name, v);
}

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ key: string[] }> }
) {
	const { env } = await getCloudflareContext({ async: true });

	const { key: keyArray } = await params;
	const key = keyArray.join("/");

	const upstream = `${MEDIA_WORKER_ORIGIN}${MEDIA_PATH_PREFIX}/${key}`;

	const h = new Headers();
	// Range/ETag preconditions
	pick(req, "range", h);
	pick(req, "if-none-match", h);
	pick(req, "if-modified-since", h);
	pick(req, "if-match", h);
	pick(req, "if-unmodified-since", h);

	// ✅ Access Service Token (server-to-server)
	const clientId = (env as any)[CF_ACCESS_CLIENT_ID_ENV];
	const clientSecret = (env as any)[CF_ACCESS_CLIENT_SECRET_ENV];

	if (clientId && clientSecret) {
		h.set("CF-Access-Client-Id", clientId);
		h.set("CF-Access-Client-Secret", clientSecret);
	}

	const res = await fetch(upstream, {
		method: "GET",
		headers: h,
		redirect: "manual", // Не проглатывать редиректы
	});

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

