"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonMeta } from "@/lib/content";
import { cn } from "@/lib/utils";

interface LessonCardProps {
  lesson: LessonMeta;
  courseSlug: string;
  lessonNumber: number;
}

export function LessonCard({ lesson, courseSlug, lessonNumber }: LessonCardProps) {
  return (
    <Card className={cn(
      "group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Lesson number */}
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold bg-muted text-muted-foreground"
          )}>
            {lessonNumber}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground leading-snug mb-2 line-clamp-2">
              {lesson.title}
            </h3>

            {/* CTA */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8"
            >
              <Link href={`/course/${courseSlug}/lesson/${lesson.slug}`}>
                <Play className="h-3 w-3 mr-1.5" />
                Start
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
