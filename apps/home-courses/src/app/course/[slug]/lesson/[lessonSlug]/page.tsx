import Link from "next/link";
import { loadLesson, loadCourse } from "@/lib/content";
import { loadHtml } from "@/lib/markdown";
import { processMediaUrlsInHtml } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug: rawLessonSlug } = await params;
  // Нормализуем lessonSlug: убираем префикс "lesson/" если он есть
  const lessonSlug = rawLessonSlug.replace(/^lesson\//, "");
  const course = await loadCourse(slug);
  const lesson = await loadLesson(slug, lessonSlug);

  if (!course || !lesson) {
    return <main style={{ padding: 24 }}>Lesson not found</main>;
  }

  const rawHtml = await loadHtml(lesson.contentHtmlKey);
  const html = processMediaUrlsInHtml(rawHtml);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href={`/course/${course.slug}`}>← Back to lessons</Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>
        {lesson.title}
      </h1>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
