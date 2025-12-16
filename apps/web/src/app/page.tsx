import Link from "next/link";
import { loadCourses } from "@/lib/content";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const courses = await loadCourses();

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Courses</h1>
      <p style={{ opacity: 0.7 }}>Выбери курс.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        {courses.map((c) => (
          <Link
            key={c.slug}
            href={`/course/${c.slug}`}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              textDecoration: "none",
            }}
          >
            <div style={{ fontWeight: 700 }}>{c.title}</div>
            <div style={{ opacity: 0.7, marginTop: 6 }}>
              {c.description ?? ""}
            </div>
            <div style={{ marginTop: 12, opacity: 0.8 }}>
              {c.lessons.length} lessons
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
