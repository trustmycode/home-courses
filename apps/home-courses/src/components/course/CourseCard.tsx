"use client";

import { Play, BookOpen, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CourseMeta } from "@/lib/content";
import { formatDuration } from "@/lib/progress";
import { cn } from "@/lib/utils";

export type CourseProgress = {
	courseSlug: string;
	totalLessons: number;
	completedLessons: number;
	progressPercentage: number;
	completed: boolean;
	totalDurationSeconds: number;
	watchedDurationSeconds: number;
	lessons?: Array<{
		lessonId: string;
		progressPercentage: number;
		completed: boolean;
		totalDurationSeconds: number;
		watchedDurationSeconds: number;
	}>;
};

interface CourseCardProps {
	course: CourseMeta;
	progress?: CourseProgress;
}

export function CourseCard({ course, progress }: CourseCardProps) {
	const totalLessons = course.lessons.length;
	const firstLessonSlug = course.lessons[0]?.slug;

	// Находим первый незавершенный урок или последний урок
	const getNextLessonSlug = () => {
		if (!progress) return firstLessonSlug;

		// Находим первый незавершенный урок
		for (const lessonProgress of progress.lessons || []) {
			if (!lessonProgress.completed) {
				const [, lessonSlug] = lessonProgress.lessonId.split("/");
				return lessonSlug;
			}
		}

		// Если все завершены, возвращаем первый урок
		return firstLessonSlug;
	};

	const nextLessonSlug = getNextLessonSlug();
	const progressPercentage = progress?.progressPercentage ?? 0;
	const isCompleted = progress?.completed ?? false;
	const isInProgress = progressPercentage > 0 && !isCompleted;
	const durationText = progress
		? formatDuration(progress.totalDurationSeconds)
		: null;

	// Определяем текст кнопки
	const getButtonText = () => {
		if (isCompleted) return "Продолжить";
		if (isInProgress) return "Продолжить";
		return "Начать";
	};

	return (
		<Card
			className={cn(
				"group transition-all duration-200 hover:shadow-lg hover:-translate-y-1 overflow-hidden"
			)}
		>
			{/* Cover area with gradient */}
			<div className="relative h-32 bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 flex items-center justify-center">
				<BookOpen className="h-12 w-12 text-primary/50" />
				{/* Status badge */}
				{progress && (isCompleted || isInProgress) && (
					<div className="absolute top-3 right-3">
						<Badge
							variant={isCompleted ? "default" : "secondary"}
							className={cn(
								isCompleted && "bg-primary text-primary-foreground"
							)}
						>
							{isCompleted ? (
								<>
									<Check className="h-3 w-3 mr-1" />
									Завершено
								</>
							) : (
								"В процессе"
							)}
						</Badge>
					</div>
				)}
			</div>

			<CardContent className="p-5">
				{/* Title */}
				<h3 className="font-semibold text-foreground text-lg leading-tight mb-2 line-clamp-2">
					{course.title}
				</h3>

				{/* Meta */}
				<p className="text-sm text-muted-foreground mb-4">
					{totalLessons}{" "}
					{totalLessons === 1 ? "урок" : totalLessons < 5 ? "урока" : "уроков"}
					{durationText && ` · ${durationText}`}
				</p>

				{/* Progress */}
				{progress && (
					<div className="mb-4">
						<div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
							<span>Прогресс</span>
							<span>
								{progress.completedLessons}/{progress.totalLessons} завершено
							</span>
						</div>
						<Progress value={progressPercentage} className="h-2" />
					</div>
				)}

				{/* Actions */}
				<div className="flex gap-2">
					{nextLessonSlug && (
						<Button asChild className="flex-1">
							<Link
								href={`/course/${course.slug}/lesson/${nextLessonSlug}`}
								prefetch={false}
							>
								<Play className="h-4 w-4 mr-2" />
								{getButtonText()}
							</Link>
						</Button>
					)}
					<Button asChild variant="outline">
						<Link href={`/course/${course.slug}`} prefetch={false}>
							Посмотреть уроки
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
