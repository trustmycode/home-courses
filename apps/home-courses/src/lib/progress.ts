import { LessonAssets, AssetMeta } from "./content";

export const COMPLETION_THRESHOLD = 90; // Порог завершенности для курса и урока (90%)

export type LessonProgressAssets = Record<
	string,
	{
		positionSeconds: number;
		durationSeconds: number | null;
		completed: boolean;
		updatedAt: string;
	}
>;

export type LessonProgress = {
	lessonId: string;
	progressPercentage: number;
	completed: boolean;
	totalDurationSeconds: number;
	watchedDurationSeconds: number;
};

/**
 * Рассчитывает прогресс урока как процент просмотренных секунд от общей длительности
 */
export function calculateLessonProgress(
	assets: LessonProgressAssets
): number {
	let totalDuration = 0;
	let watchedDuration = 0;

	for (const asset of Object.values(assets)) {
		if (asset.durationSeconds !== null && asset.durationSeconds > 0) {
			totalDuration += asset.durationSeconds;
			watchedDuration += Math.min(
				asset.positionSeconds,
				asset.durationSeconds
			);
		}
	}

	if (totalDuration === 0) {
		return 0;
	}

	return (watchedDuration / totalDuration) * 100;
}

/**
 * Рассчитывает общий прогресс курса на основе прогресса уроков
 */
export function calculateCourseProgress(
	lessons: LessonProgress[]
): number {
	let totalDuration = 0;
	let watchedDuration = 0;

	for (const lesson of lessons) {
		totalDuration += lesson.totalDurationSeconds;
		watchedDuration += lesson.watchedDurationSeconds;
	}

	if (totalDuration === 0) {
		return 0;
	}

	return (watchedDuration / totalDuration) * 100;
}

/**
 * Определяет завершенность курса (progress > 90%)
 */
export function isCourseCompleted(progressPercentage: number): boolean {
	return progressPercentage > COMPLETION_THRESHOLD;
}

/**
 * Определяет завершенность урока (progress > 90%)
 */
export function isLessonCompleted(progressPercentage: number): boolean {
	return progressPercentage > COMPLETION_THRESHOLD;
}

/**
 * Форматирует длительность в формат "12:34" (минуты:секунды) или "~4ч 15м" (часы)
 */
export function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `0:${Math.floor(seconds).toString().padStart(2, "0")}`;
	}

	const totalMinutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	// Если меньше часа, показываем минуты:секунды
	if (totalMinutes < 60) {
		return `${totalMinutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	// Если больше часа, показываем часы и минуты
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (minutes === 0) {
		return `~${hours}ч`;
	}

	return `~${hours}ч ${minutes}м`;
}

/**
 * Преобразует тип материала в русское название
 */
export function formatMediaType(
	type: "video" | "audio" | "pdf" | "image"
): string {
	const typeMap: Record<string, string> = {
		video: "Видео",
		audio: "Аудио",
		pdf: "PDF",
		image: "Изображение",
	};

	return typeMap[type] || type;
}

/**
 * Извлекает уникальные типы материалов из assets.json и возвращает русские названия
 */
export function getLessonMediaTypes(assets: LessonAssets): string[] {
	const types = new Set<string>();

	for (const asset of Object.values(assets.assets)) {
		types.add(asset.type);
	}

	return Array.from(types)
		.map((type) => formatMediaType(type as AssetMeta["type"]))
		.sort();
}

