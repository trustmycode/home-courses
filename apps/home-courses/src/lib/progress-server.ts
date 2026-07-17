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
} from "./progress";

/** Получает прогресс курса напрямую из D1 для серверных компонентов. */
export async function getCourseProgressDirect(
  courseSlug: string
): Promise<CourseProgress | null> {
  try {
    const userId = await getUserIdOrNull();
    if (!userId) return null;

    const { env } = await getCloudflareContext({ async: true });
    const course = await loadCourse(courseSlug);
    if (!course) return null;

    const rows = await env.COURSE_DB
      .prepare(
        `SELECT lesson_id, asset_id, position_seconds, duration_seconds, completed, updated_at
         FROM media_progress
         WHERE user_id=? AND lesson_id LIKE ?`
      )
      .bind(userId, `${courseSlug}/%`)
      .all<{
        lesson_id: string;
        asset_id: string;
        position_seconds: number;
        duration_seconds: number | null;
        completed: number;
        updated_at: string;
      }>();

    const assetsByLesson = new Map<string, LessonProgressAssets>();
    for (const row of rows.results ?? []) {
      const assets = assetsByLesson.get(row.lesson_id) ?? {};
      assets[row.asset_id] = {
        positionSeconds: row.position_seconds,
        durationSeconds: row.duration_seconds,
        completed: row.completed === 1,
        updatedAt: row.updated_at,
      };
      assetsByLesson.set(row.lesson_id, assets);
    }

    const lessonProgresses = course.lessons.map((lesson) => {
      const lessonId = `${courseSlug}/${lesson.slug}`;
      const assets = assetsByLesson.get(lessonId) ?? {};
      const progressPercentage = calculateLessonProgress(assets);
      let totalDurationSeconds = 0;
      let watchedDurationSeconds = 0;

      for (const asset of Object.values(assets)) {
        if (asset.durationSeconds !== null && asset.durationSeconds > 0) {
          totalDurationSeconds += asset.durationSeconds;
          watchedDurationSeconds += Math.min(asset.positionSeconds, asset.durationSeconds);
        }
      }

      return {
        lessonId,
        progressPercentage,
        completed: isLessonCompleted(progressPercentage),
        totalDurationSeconds,
        watchedDurationSeconds,
      };
    });

    const progressPercentage = calculateCourseProgress(lessonProgresses);
    return {
      courseSlug,
      totalLessons: course.lessons.length,
      completedLessons: lessonProgresses.filter((lesson) => lesson.completed).length,
      progressPercentage,
      completed: isCourseCompleted(progressPercentage),
      totalDurationSeconds: lessonProgresses.reduce(
        (sum, lesson) => sum + lesson.totalDurationSeconds,
        0
      ),
      watchedDurationSeconds: lessonProgresses.reduce(
        (sum, lesson) => sum + lesson.watchedDurationSeconds,
        0
      ),
      lessons: lessonProgresses,
    };
  } catch (error) {
    console.error(`Не удалось загрузить прогресс курса ${courseSlug}`, error);
    return null;
  }
}
