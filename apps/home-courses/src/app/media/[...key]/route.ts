import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MEDIA_PATH_PREFIX } from "@/lib/constants";

function pick(req: Request, name: string, out: Headers) {
  const v = req.headers.get(name);
  if (v) out.set(name, v);
}

/**
 * Строит URL для upstream запроса к media-worker через Service Binding.
 * Валидирует и кодирует сегменты ключа для безопасности.
 *
 * @param keyArray - массив сегментов пути из route params
 * @returns валидированный и закодированный URL для service binding
 * @throws если обнаружены небезопасные сегменты (.., пустые строки)
 */
function buildMediaUpstreamUrl(keyArray: string[]): string {
  // Валидация: запрещаем path traversal и пустые сегменты
  for (const segment of keyArray) {
    if (segment === "" || segment === ".." || segment.includes("..")) {
      throw new Error(`Invalid key segment: ${segment}`);
    }
  }

  // Кодируем каждый сегмент для безопасности
  const encodedSegments = keyArray.map((segment) =>
    encodeURIComponent(segment)
  );
  const key = encodedSegments.join("/");

  // Service Binding: host не важен, используется только путь
  // Cloudflare Workers автоматически направляет запрос к правильному service
  return `https://media.internal${MEDIA_PATH_PREFIX}/${key}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  // Проксируем медиа через service binding на home-courses-media worker
  const { env } = await getCloudflareContext({ async: true });

  const { key: keyArray } = await params;

  let upstreamUrl: string;
  try {
    upstreamUrl = buildMediaUpstreamUrl(keyArray);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const h = new Headers();
  // Range/ETag preconditions
  pick(req, "range", h);
  pick(req, "if-none-match", h);
  pick(req, "if-modified-since", h);
  pick(req, "if-match", h);
  pick(req, "if-unmodified-since", h);

  const res = await env.MEDIA.fetch(upstreamUrl, { method: "GET", headers: h });

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

  // Для Range requests важно сохранить статус 206 (Partial Content)
  // Если upstream вернул 206, передаем его дальше
  const status = res.status;

  // Убеждаемся, что body передается корректно для streaming
  return new Response(res.body, { status, headers: out });
}

export async function HEAD(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  // Проксируем медиа через service binding на home-courses-media worker
  const { env } = await getCloudflareContext({ async: true });

  const { key: keyArray } = await params;

  let upstreamUrl: string;
  try {
    upstreamUrl = buildMediaUpstreamUrl(keyArray);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const h = new Headers();
  // Range/ETag preconditions для HEAD
  pick(req, "if-none-match", h);
  pick(req, "if-modified-since", h);
  pick(req, "if-match", h);
  pick(req, "if-unmodified-since", h);
  // Range тоже пробрасываем, media-worker поддерживает HEAD с Range
  pick(req, "range", h);

  // Реальный HEAD запрос к service binding (не GET)
  const res = await env.MEDIA.fetch(upstreamUrl, {
    method: "HEAD",
    headers: h,
  });

  const out = new Headers();

  // пробрасываем заголовки (без body)
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

  return new Response(null, { status: res.status, headers: out });
}
