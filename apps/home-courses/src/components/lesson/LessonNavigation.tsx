"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LessonMeta } from "@/lib/content";

interface LessonNavigationProps {
  prevLesson?: LessonMeta | null;
  nextLesson?: LessonMeta | null;
  courseSlug: string;
}

export function LessonNavigation({ prevLesson, nextLesson, courseSlug }: LessonNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-6 border-t border-border mt-8">
      {prevLesson ? (
        <Button asChild variant="outline" className="flex-1 max-w-xs justify-start h-auto py-3">
          <Link href={`/course/${courseSlug}/lesson/${prevLesson.slug}`}>
            <ChevronLeft className="h-4 w-4 mr-2 shrink-0" />
            <div className="text-left truncate">
              <span className="text-xs text-muted-foreground block">Previous</span>
              <span className="text-sm font-medium truncate block">{prevLesson.title}</span>
            </div>
          </Link>
        </Button>
      ) : (
        <div className="flex-1 max-w-xs" />
      )}

      {nextLesson ? (
        <Button asChild variant="default" className="flex-1 max-w-xs justify-end h-auto py-3">
          <Link href={`/course/${courseSlug}/lesson/${nextLesson.slug}`}>
            <div className="text-right truncate">
              <span className="text-xs text-primary-foreground/70 block">Next</span>
              <span className="text-sm font-medium truncate block">{nextLesson.title}</span>
            </div>
            <ChevronRight className="h-4 w-4 ml-2 shrink-0" />
          </Link>
        </Button>
      ) : (
        <div className="flex-1 max-w-xs" />
      )}
    </div>
  );
}

// Mobile bottom navigation
export function MobileLessonNav({ prevLesson, nextLesson, courseSlug }: LessonNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3 lg:hidden">
      <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
        {prevLesson ? (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/course/${courseSlug}/lesson/${prevLesson.slug}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        {nextLesson ? (
          <Button asChild size="sm" className="flex-1">
            <Link href={`/course/${courseSlug}/lesson/${nextLesson.slug}`}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/course/${courseSlug}`}>Back to Lessons</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
