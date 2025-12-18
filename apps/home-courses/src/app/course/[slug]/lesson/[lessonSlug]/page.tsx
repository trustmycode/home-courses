import { ChevronLeft, List } from "lucide-react";
import Link from "next/link";
import { loadLesson, loadCourse } from "@/lib/content";
import { loadHtml } from "@/lib/markdown";
import { Header } from "@/components/layout/Header";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LessonSidebar } from "@/components/lesson/LessonSidebar";
import { LessonContent } from "@/components/lesson/LessonContent";
import { LessonNavigation, MobileLessonNav } from "@/components/lesson/LessonNavigation";
import { MarkCompletedButton } from "@/components/lesson/MarkCompletedButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserEmail } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const course = await loadCourse(slug);
  const lesson = await loadLesson(slug, lessonSlug);

  if (!course || !lesson) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Lesson not found</p>
        </main>
      </div>
    );
  }

  const html = await loadHtml(lesson.contentHtmlKey);

  // Загружаем прогресс урока
  let initialProgress = null;
  try {
    const emailOrResponse = await requireUserEmail();
    if (!(emailOrResponse instanceof Response)) {
      const email = emailOrResponse;
      const { env } = await getCloudflareContext({ async: true });
      
      // Загружаем прогресс урока
      const progressRow = await env.COURSE_DB
        .prepare(
          `SELECT is_completed, time_spent_sec, updated_at_ms
           FROM progress 
           WHERE user_email=? AND course_slug=? AND lesson_slug=?`
        )
        .bind(email, slug, lessonSlug)
        .first<{
          is_completed: number;
          time_spent_sec: number;
          updated_at_ms: number;
        }>();

      // Загружаем позиции медиа
      const mediaRows = await env.COURSE_DB
        .prepare(
          `SELECT asset_id, asset_type, position_sec, updated_at_ms
           FROM media_progress
           WHERE user_email=? AND course_slug=? AND lesson_slug=?`
        )
        .bind(email, slug, lessonSlug)
        .all<{
          asset_id: string;
          asset_type: string;
          position_sec: number;
          updated_at_ms: number;
        }>();

      const mediaPositions = (mediaRows.results ?? []).map((row) => ({
        assetId: row.asset_id,
        assetType: row.asset_type as "video" | "audio",
        positionSec: row.position_sec,
        updatedAtMs: row.updated_at_ms,
      }));

      if (progressRow) {
        initialProgress = {
          courseSlug: slug,
          lessonSlug,
          isCompleted: progressRow.is_completed === 1,
          timeSpentSec: progressRow.time_spent_sec,
          updatedAtMs: progressRow.updated_at_ms,
          mediaPositions,
        };
      } else {
        initialProgress = {
          courseSlug: slug,
          lessonSlug,
          isCompleted: false,
          timeSpentSec: 0,
          updatedAtMs: 0,
          mediaPositions,
        };
      }
    }
  } catch (error) {
    console.error("Failed to load lesson progress:", error);
    // Продолжаем без прогресса
  }

  // Находим предыдущий и следующий уроки
  const sortedLessons = [...course.lessons].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return 0;
  });
  const currentIndex = sortedLessons.findIndex(l => l.slug === lessonSlug);
  const prevLesson = currentIndex > 0 ? sortedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < sortedLessons.length - 1 ? sortedLessons[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href={`/course/${course.slug}`}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {lesson.title}
            </p>
            <p className="text-xs text-muted-foreground">
              Lesson {currentIndex + 1} of {sortedLessons.length}
            </p>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <List className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Lessons</h3>
              </div>
              <LessonSidebar 
                course={course} 
                currentLessonSlug={lessonSlug} 
                courseSlug={course.slug}
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-0 h-screen">
          <div className="flex h-full flex-col">
            {/* Back to course library */}
            <div className="p-3 border-b border-sidebar-border bg-sidebar">
              <Button variant="ghost" size="sm" asChild className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Link href={`/course/${course.slug}`}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Lessons
                </Link>
              </Button>
            </div>
            <LessonSidebar 
              course={course} 
              currentLessonSlug={lessonSlug} 
              courseSlug={course.slug}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <div className="max-w-4xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
            {/* Breadcrumbs (desktop) */}
            <Breadcrumbs 
              items={[
                { label: "Courses", href: "/" },
                { label: course.title, href: `/course/${course.slug}` },
                { label: lesson.title }
              ]}
              className="hidden lg:flex mb-6"
            />

            {/* Lesson Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  Lesson {currentIndex + 1}
                </Badge>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
        {lesson.title}
      </h1>
            </div>

            {/* Content */}
            {html && (
              <div className="mb-8">
                <LessonContent 
                  html={html} 
                  courseSlug={slug}
                  lessonSlug={lessonSlug}
                  initialProgress={initialProgress}
                />
              </div>
            )}

            {/* Mark Completed Button */}
            <div className="mb-8 flex justify-center">
              <MarkCompletedButton
                courseSlug={slug}
                lessonSlug={lessonSlug}
                initialCompleted={initialProgress?.isCompleted ?? false}
              />
            </div>

            {/* Navigation */}
            <div className="hidden lg:block">
              <LessonNavigation 
                prevLesson={prevLesson} 
                nextLesson={nextLesson} 
                courseSlug={course.slug}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileLessonNav 
        prevLesson={prevLesson} 
        nextLesson={nextLesson} 
        courseSlug={course.slug}
      />
    </div>
  );
}
