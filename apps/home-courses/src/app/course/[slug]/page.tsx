import Link from "next/link";
import { loadCourse } from "@/lib/content";

export const dynamic = 'force-dynamic';

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) return <main style={{ padding: 24 }}>Course not found</main>;

  const sortedLessons = [...course.lessons].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return 0;
  });

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/">← Back to courses</Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>
        {course.title}
      </h1>
      <p style={{ opacity: 0.7 }}>{course.description ?? ""}</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>Lessons</h2>
      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {sortedLessons.map((l) => (
          <li key={l.slug} style={{ marginBottom: 10 }}>
            <Link href={`/course/${course.slug}/lesson/${l.slug}`}>
              {l.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
