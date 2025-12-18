import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/access";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: Request) {
	const { env } = await getCloudflareContext({ async: true });
	const emailOrResponse = await requireUserEmail();
	if (emailOrResponse instanceof NextResponse) return emailOrResponse;
	const email = emailOrResponse;

	const url = new URL(req.url);
	const courseSlug = url.searchParams.get("courseSlug");
	const lessonSlug = url.searchParams.get("lessonSlug");

	if (!courseSlug || !lessonSlug) {
		return NextResponse.json(
			{ error: "courseSlug and lessonSlug required" },
			{ status: 400 }
		);
	}

	// Загружаем прогресс урока
	const progressRow = await env.COURSE_DB
		.prepare(
			`SELECT is_completed, time_spent_sec, updated_at_ms
       FROM progress 
       WHERE user_email=? AND course_slug=? AND lesson_slug=?`
		)
		.bind(email, courseSlug, lessonSlug)
		.first<{
			is_completed: number;
			time_spent_sec: number;
			updated_at_ms: number;
		}>();

	// Загружаем позиции медиа
	const mediaRows = await env.COURSE_DB
		.prepare(
			`SELECT asset_id, asset_type, position_sec, updated_at_ms
       FROM media_progress
       WHERE user_email=? AND course_slug=? AND lesson_slug=?`
		)
		.bind(email, courseSlug, lessonSlug)
		.all<{
			asset_id: string;
			asset_type: string;
			position_sec: number;
			updated_at_ms: number;
		}>();

	const mediaPositions = (mediaRows.results ?? []).map((row) => ({
		assetId: row.asset_id,
		assetType: row.asset_type as "video" | "audio",
		positionSec: row.position_sec,
		updatedAtMs: row.updated_at_ms,
	}));

	if (!progressRow) {
		// Если прогресса нет, возвращаем дефолтные значения
		return NextResponse.json({
			courseSlug,
			lessonSlug,
			isCompleted: false,
			timeSpentSec: 0,
			updatedAtMs: 0,
			mediaPositions,
		});
	}

	return NextResponse.json({
		courseSlug,
		lessonSlug,
		isCompleted: progressRow.is_completed === 1,
		timeSpentSec: progressRow.time_spent_sec,
		updatedAtMs: progressRow.updated_at_ms,
		mediaPositions,
	});
}

export async function POST(req: Request) {
	const { env } = await getCloudflareContext({ async: true });
	const emailOrResponse = await requireUserEmail();
	if (emailOrResponse instanceof NextResponse) return emailOrResponse;
	const email = emailOrResponse;

	// CSRF защита: проверяем Origin header
	const origin = req.headers.get("origin");
	const requestUrl = new URL(req.url);
	const expectedOrigin = requestUrl.origin;

	// В dev окружении разрешаем localhost origins
	const allowedOrigins =
		process.env.NODE_ENV === "development"
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
		timeSpentSecDelta?: number;
		mediaPositions?: Array<{
			assetId: string;
			assetType: "video" | "audio";
			positionSec: number;
			clientUpdatedAtMs: number;
		}>;
		isCompleted?: boolean;
	};

	const {
		courseSlug,
		lessonSlug,
		timeSpentSecDelta = 0,
		mediaPositions = [],
		isCompleted = false,
	} = body ?? {};

	if (!courseSlug || !lessonSlug) {
		return NextResponse.json(
			{ error: "courseSlug & lessonSlug required" },
			{ status: 400 }
		);
	}

	const now = Date.now();

	// Обновляем или создаём запись прогресса урока
	// Используем дельту для time_spent_sec
	await env.COURSE_DB
		.prepare(
			`INSERT INTO progress(user_email, course_slug, lesson_slug, is_completed, last_position_sec, time_spent_sec, updated_at_ms)
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(user_email, course_slug, lesson_slug) DO UPDATE SET
         is_completed=excluded.is_completed,
         time_spent_sec=time_spent_sec + excluded.time_spent_sec,
         updated_at_ms=excluded.updated_at_ms`
		)
		.bind(
			email,
			courseSlug,
			lessonSlug,
			isCompleted ? 1 : 0,
			0, // last_position_sec (deprecated, но оставляем для совместимости)
			Math.max(0, Math.floor(timeSpentSecDelta)),
			now
		)
		.run();

	// Обновляем позиции медиа с LWW (Last Write Wins) по updated_at_ms
	for (const mediaPos of mediaPositions) {
		await env.COURSE_DB
			.prepare(
				`INSERT INTO media_progress(user_email, course_slug, lesson_slug, asset_id, asset_type, position_sec, updated_at_ms)
         VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(user_email, course_slug, lesson_slug, asset_id) DO UPDATE SET
           asset_type=excluded.asset_type,
           position_sec=CASE 
             WHEN excluded.updated_at_ms >= media_progress.updated_at_ms 
             THEN excluded.position_sec 
             ELSE media_progress.position_sec 
           END,
           updated_at_ms=CASE 
             WHEN excluded.updated_at_ms >= media_progress.updated_at_ms 
             THEN excluded.updated_at_ms 
             ELSE media_progress.updated_at_ms 
           END`
			)
			.bind(
				email,
				courseSlug,
				lessonSlug,
				mediaPos.assetId,
				mediaPos.assetType,
				Math.floor(mediaPos.positionSec),
				mediaPos.clientUpdatedAtMs
			)
			.run();
	}

	return NextResponse.json({ ok: true, updatedAtMs: now });
}
