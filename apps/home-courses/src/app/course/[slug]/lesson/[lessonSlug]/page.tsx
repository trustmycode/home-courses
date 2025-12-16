import Link from "next/link";
import { loadLesson, loadCourse, loadLessonAssets } from "@/lib/content";
import { loadMdx } from "@/lib/markdown";
import { mediaUrl, processMediaUrlsInHtml } from "@/lib/media";

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const course = await loadCourse(slug);
  const lesson = await loadLesson(slug, lessonSlug);

  if (!course || !lesson) {
    return <main style={{ padding: 24 }}>Lesson not found</main>;
  }

  const [rawHtml, assets] = await Promise.all([
    loadMdx(lesson.contentKey),
    loadLessonAssets(lesson.assetsKey),
  ]);

  const html = processMediaUrlsInHtml(rawHtml);

  const firstVideo = Object.values(assets.assets).find(
    (asset) => asset.type === "video"
  );

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href={`/course/${course.slug}`}>← Back to lessons</Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>
        {lesson.title}
      </h1>

      {firstVideo ? (
        <div style={{ marginTop: 16 }}>
          <video
            controls
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
            src={mediaUrl(firstVideo.r2Key)}
          />
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          Нет видео для этого урока.
        </div>
      )}

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
