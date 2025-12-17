"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseMeta, LessonMeta } from "@/lib/content";
import { cn } from "@/lib/utils";

interface LessonSidebarProps {
  course: CourseMeta;
  currentLessonSlug?: string;
  courseSlug: string;
}

export function LessonSidebar({ course, currentLessonSlug, courseSlug }: LessonSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Course header */}
      <div className="p-4 border-b border-sidebar-border">
        <Link 
          href={`/course/${courseSlug}`}
          prefetch={false}
          className="font-semibold text-sidebar-foreground text-sm mb-2 block hover:text-primary transition-colors"
        >
          {course.title}
        </Link>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Lessons</span>
            <span>{course.lessons.length} total</span>
          </div>
        </div>
      </div>

      {/* Lesson list */}
      <ScrollArea className="flex-1">
        <nav className="p-2">
          {course.lessons.map((lesson, index) => (
            <LessonSidebarItem 
              key={lesson.slug} 
              lesson={lesson} 
              lessonNumber={index + 1}
              isActive={lesson.slug === currentLessonSlug}
              courseSlug={courseSlug}
            />
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}

interface LessonSidebarItemProps {
  lesson: LessonMeta;
  lessonNumber: number;
  isActive: boolean;
  courseSlug: string;
}

function LessonSidebarItem({ lesson, lessonNumber, isActive, courseSlug }: LessonSidebarItemProps) {
  return (
    <Link
      href={`/course/${courseSlug}/lesson/${lesson.slug}`}
      prefetch={false}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-1",
        isActive 
          ? "bg-sidebar-primary text-sidebar-primary-foreground" 
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      {/* Status icon */}
      <div className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
        isActive && "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground",
        !isActive && "bg-muted text-muted-foreground"
      )}>
        {isActive ? (
          <Play className="h-3 w-3" />
        ) : (
          <span>{lessonNumber}</span>
        )}
      </div>

      {/* Lesson info */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{lesson.title}</p>
      </div>
    </Link>
  );
}
