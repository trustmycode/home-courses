import Link from "next/link";
import { loadCourse } from "@/lib/content";

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const course = await loadCourse(params.slug);
  if (!course) return <main style={{ padding: 24 }}>Course not found</main>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/">← Back to courses</Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>{course.title}</h1>
      <p style={{ opacity: 0.7 }}>{course.description ?? ""}</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>Lessons</h2>
      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {course.lessons.map((l) => (
          <li key={l.slug} style={{ marginBottom: 10 }}>
            <Link href={`/course/${course.slug}/lesson/${l.slug}`}>
              {l.title}
            </Link>
            {l.durationSec ? <span style={{ opacity: 0.6 }}> — {Math.round(l.durationSec / 60)} min</span> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

