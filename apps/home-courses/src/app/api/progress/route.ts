import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/access";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: Request) {
	try {
		const { env } = await getCloudflareContext({ async: true });
		const userIdOrResponse = await requireUserId();
		if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
		const userId = userIdOrResponse;

		const url = new URL(req.url);
		const lessonId = url.searchParams.get("lessonId");

		if (!lessonId) {
			return NextResponse.json({ error: "lessonId required" }, { status: 400 });
		}

		// Загружаем прогресс всех ассетов урока
		const rows = await env.COURSE_DB
			.prepare(
				`SELECT asset_id, position_seconds, duration_seconds, completed, updated_at
       FROM media_progress
       WHERE user_id=? AND lesson_id=?`
			)
			.bind(userId, lessonId)
			.all<{
				asset_id: string;
				position_seconds: number;
				duration_seconds: number | null;
				completed: number;
				updated_at: string;
			}>();

		const assets: Record<
			string,
			{
				positionSeconds: number;
				durationSeconds: number | null;
				completed: boolean;
				updatedAt: string;
			}
		> = {};

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
		console.error("Error in GET /api/progress:", error);
		return NextResponse.json(
			{ error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
}

export async function PUT(req: Request) {
	try {
		const { env } = await getCloudflareContext({ async: true });
		const userIdOrResponse = await requireUserId();
		if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
		const userId = userIdOrResponse;

		// CSRF защита
		const origin = req.headers.get("origin");
		const requestUrl = new URL(req.url);
		const expectedOrigin = requestUrl.origin;
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
			lessonId: string;
			assetId: string;
			positionSeconds?: number;
			durationSeconds?: number;
			completed?: boolean;
		};

		const {
			lessonId,
			assetId,
			positionSeconds = 0,
			durationSeconds,
			completed = false,
		} = body;

		if (!lessonId || !assetId) {
			return NextResponse.json(
				{ error: "lessonId and assetId required" },
				{ status: 400 }
			);
		}

		// Убеждаемся, что пользователь существует
		try {
			await env.COURSE_DB.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`).bind(userId).run();
		} catch (error) {
			console.error("Error creating user:", error);
			// Продолжаем, возможно таблица не существует или другая ошибка
		}

		// Убеждаемся, что урок существует (создаем запись если нужно)
		// lessonId должен быть в формате "courseSlug/lessonSlug"
		const [courseSlug, lessonSlug] = lessonId.split("/");
		if (courseSlug && lessonSlug) {
			try {
				await env.COURSE_DB
					.prepare(
						`INSERT OR IGNORE INTO lessons (lesson_id, course_slug, lesson_slug, title)
         VALUES (?, ?, ?, ?)`
					)
					.bind(lessonId, courseSlug, lessonSlug, lessonSlug) // title можно получить из индекса
					.run();
			} catch (error) {
				console.error("Error creating lesson:", error);
				// Продолжаем, возможно таблица не существует или другая ошибка
			}
		}

		// Upsert прогресса
		try {
			await env.COURSE_DB
				.prepare(
					`INSERT INTO media_progress (user_id, lesson_id, asset_id, position_seconds, duration_seconds, completed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, lesson_id, asset_id) DO UPDATE SET
         position_seconds=excluded.position_seconds,
         duration_seconds=COALESCE(excluded.duration_seconds, media_progress.duration_seconds),
         completed=excluded.completed,
         updated_at=excluded.updated_at`
				)
				.bind(
					userId,
					lessonId,
					assetId,
					positionSeconds,
					durationSeconds ?? null,
					completed ? 1 : 0
				)
				.run();
		} catch (error) {
			console.error("Error upserting media progress:", error);
			console.error("Details:", {
				userId,
				lessonId,
				assetId,
				positionSeconds,
				durationSeconds,
				completed,
			});
			return NextResponse.json(
				{
					error: "Failed to save progress",
					details: error instanceof Error ? error.message : String(error),
				},
				{ status: 500 }
			);
		}

		return new NextResponse(null, { status: 204 });
	} catch (error) {
		console.error("Error in PUT /api/progress:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
