import { NextResponse } from "next/server";

import { getUserEmail } from "@/lib/access";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const email = getUserEmail();

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
  const email = getUserEmail();

  const body = await req.json();
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

