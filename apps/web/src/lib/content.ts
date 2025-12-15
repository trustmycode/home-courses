import fs from "node:fs/promises";
import path from "node:path";

export type LessonMeta = {
  slug: string;
  title: string;
  durationSec?: number;
  videoKey?: string | null;
  audioKey?: string | null;
  textPath: string;
};

export type CourseMeta = {
  slug: string;
  title: string;
  description?: string;
  lessons: LessonMeta[];
};

export type CoursesManifest = {
  courses: CourseMeta[];
};

const repoRoot = process.cwd(); // apps/web/apps/web во время runtime
const manifestPath = path.join(repoRoot, "..", "..", "..", "..", "content", "courses.json");

export async function loadCourses(): Promise<CoursesManifest> {
  const raw = await fs.readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as CoursesManifest;
}

export async function loadCourse(courseSlug: string): Promise<CourseMeta | null> {
  const manifest = await loadCourses();
  return manifest.courses.find((c) => c.slug === courseSlug) ?? null;
}

export async function loadLesson(courseSlug: string, lessonSlug: string): Promise<LessonMeta | null> {
  const course = await loadCourse(courseSlug);
  if (!course) return null;
  return course.lessons.find((l) => l.slug === lessonSlug) ?? null;
}

