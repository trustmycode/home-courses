import { NextResponse } from "next/server";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { env } = getCloudflareContext();

  const { key: keyArray } = await params;
  const key = keyArray.join("/");

  const obj = await env.COURSE_MEDIA.get(key);

  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}

