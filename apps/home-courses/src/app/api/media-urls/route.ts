import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserEmail } from "@/lib/access";
import { loadLesson, loadLessonAssets } from "@/lib/content";

/**
 * Генерирует HMAC-SHA256 подпись для медиа-файла
 * @param key - R2 ключ медиа-файла
 * @param exp - Unix timestamp истечения подписи
 * @param secret - Секретный ключ для подписи
 * @returns Base64url-encoded подпись (без padding)
 */
async function sign(key: string, exp: number, secret: string): Promise<string> {
	const data = `${key}:${exp}`;
	const encoder = new TextEncoder();
	const keyBytes = encoder.encode(secret);
	const dataBytes = encoder.encode(data);
	
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	
	const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
	const bytes = new Uint8Array(signature);
	
	// Кодируем в base64url (без padding)
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function GET(req: Request) {
	// Проверяем авторизацию через Cloudflare Access
	const emailOrResponse = await requireUserEmail();
	if (emailOrResponse instanceof NextResponse) {
		return emailOrResponse;
	}

	const { env } = await getCloudflareContext({ async: true });
	
	// Получаем секрет для подписи
	const secret = env.MEDIA_SIGNING_SECRET;
	if (!secret) {
		console.error("MEDIA_SIGNING_SECRET is not configured");
		return NextResponse.json(
			{ error: "Server configuration error" },
			{ status: 500 }
		);
	}

	// Получаем параметры из query string
	const url = new URL(req.url);
	const courseSlug = url.searchParams.get("courseSlug");
	const lessonSlug = url.searchParams.get("lessonSlug");
	
	if (!courseSlug || !lessonSlug) {
		return NextResponse.json(
			{ error: "Missing 'courseSlug' or 'lessonSlug' parameter" },
			{ status: 400 }
		);
	}

	// Загружаем lesson и assets
	const lesson = await loadLesson(courseSlug, lessonSlug);
	if (!lesson) {
		return NextResponse.json(
			{ error: "Lesson not found" },
			{ status: 404 }
		);
	}

	const assets = await loadLessonAssets(lesson.assetsKey);
	
	// Получаем базовый URL для медиа из переменной окружения
	const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://home-courses-media.ourhomecources.workers.dev";
	
	// Генерируем время истечения (1 час = 3600 секунд)
	const exp = Math.floor(Date.now() / 1000) + 3600;
	
	// Генерируем signed URLs для всех ассетов
	const assetsById: Record<string, { url: string; kind: string }> = {};
	
	for (const [assetId, asset] of Object.entries(assets.assets)) {
		// Нормализуем ключ: убираем пробелы и лишние слэши
		const key = asset.r2Key.trim().replace(/^\/+/, "").replace(/\/+$/, "");
		
		// Валидация ключа: запрещаем path traversal
		if (key.includes("..") || key.startsWith("/")) {
			console.warn(`Invalid key format for asset ${assetId}: ${key}`);
			continue;
		}
		
		// Генерируем подпись для оригинального ключа
		const sig = await sign(key, exp, secret);
		
		// Формируем подписанный URL
		const signedUrl = `${mediaBaseUrl}/media/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
		
		assetsById[assetId] = {
			url: signedUrl,
			kind: asset.type,
		};
	}
	
	// Логируем для отладки (только в development)
	if (process.env.NODE_ENV === "development") {
		console.log("Generated signed URLs for lesson", { 
			courseSlug,
			lessonSlug,
			assetCount: Object.keys(assetsById).length,
			exp,
		});
	}
	
	// Возвращаем ответ с Cache-Control (55 минут, если URL живёт 1 час)
	return NextResponse.json(
		{ assetsById },
		{
			headers: {
				"Cache-Control": "public, max-age=3300",
			},
		}
	);
}
