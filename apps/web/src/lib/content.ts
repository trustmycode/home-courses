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

async function findRepoRoot(startPath: string): Promise<string> {
  let current = path.resolve(startPath);
  
  while (current !== path.dirname(current)) {
    const contentPath = path.join(current, "content", "courses.json");
    try {
      await fs.access(contentPath);
      return current;
    } catch {
      // Continue searching
    }
    current = path.dirname(current);
  }
  
  throw new Error("Could not find repo root (content/courses.json)");
}

let repoRootCache: string | null = null;

async function getRepoRoot(): Promise<string> {
  if (repoRootCache) return repoRootCache;
  
  const startPath = process.cwd();
  repoRootCache = await findRepoRoot(startPath);
  return repoRootCache;
}

export async function loadCourses(): Promise<CoursesManifest> {
  const repoRoot = await getRepoRoot();
  const manifestPath = path.join(repoRoot, "content", "courses.json");
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