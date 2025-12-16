import { loadCourses } from "@/lib/content";
import { Header } from "@/components/layout/Header";
import { CourseCard } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const courses = await loadCourses();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Courses</h1>
          <p className="text-muted-foreground">
            Pick a course and continue where you left off.
          </p>
        </div>

        {/* Course grid */}
        {courses.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium text-foreground mb-2">
              No courses yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add a course folder and content files to the repository.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
