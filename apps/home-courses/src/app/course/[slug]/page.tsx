import { loadCourse } from "@/lib/content";
import { Header } from "@/components/layout/Header";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LessonCard } from "@/components/lesson/LessonCard";

export const dynamic = 'force-dynamic';

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Course not found</p>
        </main>
      </div>
    );
  }

  const sortedLessons = [...course.lessons].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: "Courses", href: "/" },
            { label: course.title }
          ]}
          className="mb-6"
        />

        {/* Course header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
        {course.title}
      </h1>
          {course.description && (
            <p className="text-muted-foreground">{course.description}</p>
          )}
        </div>

        {/* Lessons */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Lessons</h2>
          <div className="grid gap-4">
            {sortedLessons.map((lesson, index) => (
              <LessonCard 
                key={lesson.slug} 
                lesson={lesson}
                courseSlug={course.slug}
                lessonNumber={index + 1}
              />
            ))}
          </div>
        </div>
    </main>
    </div>
  );
}
