import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	R2_INDEX_KEY,
	CACHE_NAME_INDEX,
	CACHE_KEY_INDEX,
	CACHE_MAX_AGE_INDEX,
} from "./constants";

export type LessonMeta = {
  slug: string;
  title: string;
  order?: number;
  contentHtmlKey: string;
  contentMdxKey?: string;
  assetsKey: string;
};

export type CourseMeta = {
  slug: string;
  title: string;
  description?: string;
  lessons: LessonMeta[];
};

export type CoursesIndex = {
  version: number;
  courses: CourseMeta[];
};

export type AssetMeta = {
  type: "video" | "audio" | "pdf" | "image";
  title: string;
  r2Key: string;
  mime: string;
};

export type LessonAssets = {
  version: number;
  assets: Record<string, AssetMeta>;
};

export async function loadIndex(): Promise<CoursesIndex> {
  // Используем Cache API для кэширования индекса
  const cacheKey = new Request(CACHE_KEY_INDEX);
  const cache = await caches.open(CACHE_NAME_INDEX);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const cachedData = await cached.json();
    return cachedData as CoursesIndex;
  }

  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.COURSE_MEDIA.get(R2_INDEX_KEY);

  if (!obj) {
    throw new Error(`${R2_INDEX_KEY} not found in R2`);
  }

  const text = await obj.text();
  const index = JSON.parse(text) as CoursesIndex;

  // Кэшируем на указанное время
  const response = new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_INDEX}`,
    },
  });
  await cache.put(cacheKey, response.clone());

  return index;
}

export async function loadCourses(): Promise<CourseMeta[]> {
  const index = await loadIndex();
  return index.courses;
}

export async function loadCourse(
  courseSlug: string
): Promise<CourseMeta | null> {
  const courses = await loadCourses();
  return courses.find((c) => c.slug === courseSlug) ?? null;
}

export async function loadLesson(
  courseSlug: string,
  lessonSlug: string
): Promise<LessonMeta | null> {
  const course = await loadCourse(courseSlug);
  if (!course) return null;
  return course.lessons.find((l) => l.slug === lessonSlug) ?? null;
}

export async function loadLessonAssets(
  assetsKey: string
): Promise<LessonAssets> {
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.COURSE_MEDIA.get(assetsKey);

  if (!obj) {
    throw new Error(`Assets file not found in R2: ${assetsKey}`);
  }

  const text = await obj.text();
  return JSON.parse(text) as LessonAssets;
}
