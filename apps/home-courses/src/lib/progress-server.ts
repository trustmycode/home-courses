import { loadCourse } from "./content";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserIdOrNull } from "./access";
import type { CourseProgress } from "@/components/course/CourseCard";
import {
	calculateLessonProgress,
	calculateCourseProgress,
	isCourseCompleted,
	isLessonCompleted,
	type LessonProgressAssets,
	type LessonProgress,
} from "./progress";

/**
 * Получает прогресс курса напрямую из БД (для использования в серверных компонентах)
 */
export async function getCourseProgressDirect(
	courseSlug: string
): Promise<CourseProgress | null> {
	try {
		const userId = await getUserIdOrNull();
		if (!userId) return null;

		const { env } = await getCloudflareContext({ async: true });
		const course = await loadCourse(courseSlug);
		if (!course) return null;

		// Получаем прогресс всех уроков курса
		const lessonProgresses = await Promise.all(
			course.lessons.map(async (lesson) => {
				const lessonId = `${courseSlug}/${lesson.slug}`;

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

				const assets: LessonProgressAssets = {};

				for (const row of rows.results ?? []) {
					assets[row.asset_id] = {
						positionSeconds: row.position_seconds,
						durationSeconds: row.duration_seconds,
						completed: row.completed === 1,
						updatedAt: row.updated_at,
					};
				}

				// Рассчитываем прогресс урока
				const progressPercentage = calculateLessonProgress(assets);

				// Рассчитываем длительности
				let totalDurationSeconds = 0;
				let watchedDurationSeconds = 0;

				for (const asset of Object.values(assets)) {
					if (asset.durationSeconds !== null && asset.durationSeconds > 0) {
						totalDurationSeconds += asset.durationSeconds;
						watchedDurationSeconds += Math.min(
							asset.positionSeconds,
							asset.durationSeconds
						);
					}
				}

				return {
					lessonId,
					progressPercentage,
					completed: isLessonCompleted(progressPercentage),
					totalDurationSeconds,
					watchedDurationSeconds,
				};
			})
		);

		// Рассчитываем общий прогресс курса
		const progressPercentage = calculateCourseProgress(lessonProgresses);
		const completed = isCourseCompleted(progressPercentage);

		// Считаем завершенные уроки
		const completedLessons = lessonProgresses.filter((l) => l.completed).length;

		// Суммируем длительности
		const totalDurationSeconds = lessonProgresses.reduce(
			(sum, l) => sum + l.totalDurationSeconds,
			0
		);
		const watchedDurationSeconds = lessonProgresses.reduce(
			(sum, l) => sum + l.watchedDurationSeconds,
			0
		);

		return {
			courseSlug,
			totalLessons: course.lessons.length,
			completedLessons,
			progressPercentage,
			completed,
			totalDurationSeconds,
			watchedDurationSeconds,
			lessons: lessonProgresses,
		};
	} catch (error) {
		console.error(`Failed to load progress for course ${courseSlug}:`, error);
		return null;
	}
}
