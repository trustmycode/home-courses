"use client";

import { Play, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseMeta } from "@/lib/content";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: CourseMeta;
}

export function CourseCard({ course }: CourseCardProps) {
  const totalLessons = course.lessons.length;
  const firstLessonSlug = course.lessons[0]?.slug;

  return (
    <Card className={cn(
      "group transition-all duration-200 hover:shadow-lg hover:-translate-y-1 overflow-hidden"
    )}>
      {/* Cover area with gradient */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 flex items-center justify-center">
        <BookOpen className="h-12 w-12 text-primary/50" />
      </div>

      <CardContent className="p-5">
        {/* Title */}
        <h3 className="font-semibold text-foreground text-lg leading-tight mb-2 line-clamp-2">
          {course.title}
        </h3>

        {/* Meta */}
        <p className="text-sm text-muted-foreground mb-4">
          {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"}
          {course.description && ` • ${course.description}`}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          {firstLessonSlug && (
            <Button asChild className="flex-1">
              <Link href={`/course/${course.slug}/lesson/${firstLessonSlug}`} prefetch={false}>
                <Play className="h-4 w-4 mr-2" />
                Start
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/course/${course.slug}`} prefetch={false}>
              View lessons
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
