import { NextResponse } from "next/server";

import { requireUserEmail } from "@/lib/access";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const emailOrResponse = await requireUserEmail();
  if (emailOrResponse instanceof NextResponse) return emailOrResponse;
  const email = emailOrResponse;

  const url = new URL(req.url);
  const courseSlug = url.searchParams.get("courseSlug");

  if (!courseSlug) return NextResponse.json({ error: "courseSlug required" }, { status: 400 });

  const rows = await env.COURSE_DB
    .prepare(`SELECT lesson_slug, is_completed, last_position_sec, updated_at_ms
              FROM progress WHERE user_email=? AND course_slug=?`)
    .bind(email, courseSlug)
    .all();

  return NextResponse.json({ lessons: rows.results ?? [] });
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const emailOrResponse = await requireUserEmail();
  if (emailOrResponse instanceof NextResponse) return emailOrResponse;
  const email = emailOrResponse;

  // CSRF защита: проверяем Origin header
  const origin = req.headers.get("origin");
  const requestUrl = new URL(req.url);
  const expectedOrigin = requestUrl.origin;

  // В dev окружении разрешаем localhost origins
  const allowedOrigins = process.env.NODE_ENV === "development"
    ? [expectedOrigin, "http://localhost:3000", "http://127.0.0.1:3000"]
    : [expectedOrigin];

  if (!origin || !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { error: "Forbidden: invalid origin" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    courseSlug?: string;
    lessonSlug?: string;
    positionSec?: number;
    isCompleted?: boolean;
  };
  const { courseSlug, lessonSlug, positionSec = 0, isCompleted = false } = body ?? {};

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json({ error: "courseSlug & lessonSlug required" }, { status: 400 });
  }

  const now = Date.now();

  await env.COURSE_DB
    .prepare(`INSERT INTO progress(user_email, course_slug, lesson_slug, is_completed, last_position_sec, updated_at_ms)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(user_email, course_slug, lesson_slug) DO UPDATE SET
                is_completed=excluded.is_completed,
                last_position_sec=excluded.last_position_sec,
                updated_at_ms=excluded.updated_at_ms`)
    .bind(email, courseSlug, lessonSlug, isCompleted ? 1 : 0, Math.floor(positionSec), now)
    .run();

  return NextResponse.json({ ok: true, updatedAtMs: now });
}

