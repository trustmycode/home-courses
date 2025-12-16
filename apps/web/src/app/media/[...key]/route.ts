import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type R2Range =
  | { offset: number; length?: number }
  | { length: number; offset?: number }
  | { suffix: number };

function tryParseRange(rangeHeader: string | null): R2Range | undefined {
  if (!rangeHeader) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!m) return undefined;

  const lhs = m[1] === "" ? undefined : parseInt(m[1], 10);
  const rhs = m[2] === "" ? undefined : parseInt(m[2], 10);

  if (lhs === undefined && typeof rhs === "number") return { suffix: rhs };

  if (typeof lhs === "number" && rhs === undefined) return { offset: lhs };

  if (typeof lhs === "number" && typeof rhs === "number") {
    const length = rhs - lhs + 1;
    if (length > 0) return { offset: lhs, length };
  }

  return undefined;
}

function computeContentRange(range: R2Range, size: number) {
  const offset = "offset" in range ? range.offset : undefined;
  const length = "length" in range ? range.length : undefined;
  const suffix = "suffix" in range ? range.suffix : undefined;

  const start =
    typeof suffix === "number"
      ? Math.max(0, size - suffix)
      : typeof offset === "number"
      ? offset
      : 0;

  const endExclusive =
    typeof suffix === "number"
      ? size
      : typeof length === "number"
      ? Math.min(size, start + length)
      : size;

  return {
    start,
    endExclusive,
    header: `bytes ${start}-${endExclusive - 1}/${size}`,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const { key: keyArray } = await params;
  const key = keyArray.join("/");

  const range = tryParseRange(req.headers.get("Range"));

  const obj = await env.COURSE_MEDIA.get(key, range ? { range } : undefined);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const headers = new Headers();
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");

  if (obj.etag) headers.set("ETag", obj.etag);
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());

  if (range) {
    const size = obj.size;
    const { start, endExclusive, header } = computeContentRange(range, size);

    if (start >= size) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Range", header);
    headers.set("Content-Length", String(endExclusive - start));
    return new Response(obj.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}
