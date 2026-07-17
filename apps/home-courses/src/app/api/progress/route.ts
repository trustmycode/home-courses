import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/access";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const LESSON_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}\/[a-z0-9][a-z0-9_-]{0,79}$/i;
const ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const MAX_MEDIA_SECONDS = 7 * 24 * 60 * 60;

function validSeconds(value: unknown, optional = false): value is number | undefined {
  if (optional && value === undefined) return true;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_MEDIA_SECONDS;
}

export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const userIdOrResponse = await requireUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const lessonId = new URL(req.url).searchParams.get("lessonId");
    if (!lessonId || !LESSON_ID_PATTERN.test(lessonId)) {
      return NextResponse.json({ error: "Некорректный идентификатор урока" }, { status: 400 });
    }

    const rows = await env.COURSE_DB
      .prepare(
        `SELECT asset_id, position_seconds, duration_seconds, completed, updated_at
         FROM media_progress
         WHERE user_id=? AND lesson_id=?`
      )
      .bind(userIdOrResponse, lessonId)
      .all<{
        asset_id: string;
        position_seconds: number;
        duration_seconds: number | null;
        completed: number;
        updated_at: string;
      }>();

    const assets: Record<string, {
      positionSeconds: number;
      durationSeconds: number | null;
      completed: boolean;
      updatedAt: string;
    }> = {};

    for (const row of rows.results ?? []) {
      assets[row.asset_id] = {
        positionSeconds: row.position_seconds,
        durationSeconds: row.duration_seconds,
        completed: row.completed === 1,
        updatedAt: row.updated_at,
      };
    }

    return NextResponse.json({ lessonId, assets });
  } catch (error) {
    console.error("Не удалось загрузить прогресс урока", error);
    return NextResponse.json({ error: "Не удалось загрузить прогресс" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const userIdOrResponse = await requireUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const origin = req.headers.get("origin");
    const requestUrl = new URL(req.url);
    const allowedOrigins =
      process.env.NODE_ENV === "development"
        ? [requestUrl.origin, "http://localhost:3000", "http://127.0.0.1:3000"]
        : [requestUrl.origin];
    if (!origin || !allowedOrigins.includes(origin)) {
      return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Тело запроса должно быть в формате JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const lessonId = input.lessonId;
    const assetId = input.assetId;
    const positionSeconds = input.positionSeconds ?? 0;
    const durationSeconds = input.durationSeconds;
    const completed = input.completed ?? false;

    if (
      typeof lessonId !== "string" ||
      !LESSON_ID_PATTERN.test(lessonId) ||
      typeof assetId !== "string" ||
      !ASSET_ID_PATTERN.test(assetId) ||
      !validSeconds(positionSeconds) ||
      !validSeconds(durationSeconds, true) ||
      typeof completed !== "boolean"
    ) {
      return NextResponse.json({ error: "Некорректные данные прогресса" }, { status: 400 });
    }

    const [courseSlug, lessonSlug] = lessonId.split("/");
    await env.COURSE_DB.batch([
      env.COURSE_DB.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").bind(userIdOrResponse),
      env.COURSE_DB
        .prepare(
          `INSERT OR IGNORE INTO lessons (lesson_id, course_slug, lesson_slug, title)
           VALUES (?, ?, ?, ?)`
        )
        .bind(lessonId, courseSlug, lessonSlug, lessonSlug),
      env.COURSE_DB
        .prepare(
          `INSERT INTO media_progress
             (user_id, lesson_id, asset_id, position_seconds, duration_seconds, completed, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, lesson_id, asset_id) DO UPDATE SET
             position_seconds=MAX(media_progress.position_seconds, excluded.position_seconds),
             duration_seconds=CASE
               WHEN excluded.duration_seconds IS NULL THEN media_progress.duration_seconds
               WHEN media_progress.duration_seconds IS NULL THEN excluded.duration_seconds
               ELSE MAX(media_progress.duration_seconds, excluded.duration_seconds)
             END,
             completed=MAX(media_progress.completed, excluded.completed),
             updated_at=excluded.updated_at`
        )
        .bind(
          userIdOrResponse,
          lessonId,
          assetId,
          positionSeconds,
          durationSeconds ?? null,
          completed ? 1 : 0
        ),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Не удалось сохранить прогресс урока", error);
    return NextResponse.json({ error: "Не удалось сохранить прогресс" }, { status: 500 });
  }
}
