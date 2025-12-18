"use client";

import { Play, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LessonMeta } from "@/lib/content";
import { formatDuration } from "@/lib/progress";
import { cn } from "@/lib/utils";

export type LessonProgress = {
	lessonId: string;
	progressPercentage: number;
	completed: boolean;
	totalDurationSeconds: number;
	watchedDurationSeconds: number;
};

interface LessonCardProps {
	lesson: LessonMeta;
	courseSlug: string;
	lessonNumber: number;
	progress?: LessonProgress;
	mediaTypes?: string[];
}

export function LessonCard({
	lesson,
	courseSlug,
	lessonNumber,
	progress,
	mediaTypes = [],
}: LessonCardProps) {
	const progressPercentage = progress?.progressPercentage ?? 0;
	const isCompleted = progress?.completed ?? false;
	const isInProgress = progressPercentage > 0 && !isCompleted;
	const durationText = progress
		? formatDuration(progress.totalDurationSeconds)
		: null;

	// Определяем текст кнопки
	const getButtonText = () => {
		if (isCompleted) return "Пересмотреть";
		if (isInProgress) return "Продолжить";
		return "Начать";
	};

	return (
		<Card
			className={cn(
				"group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
				isInProgress && "border-primary/20"
			)}
		>
			<CardContent className="p-5">
				{/* Lesson number with status */}
				<div className="flex items-start gap-4 mb-4">
					<div
						className={cn(
							"flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
							isCompleted
								? "bg-primary/10 text-primary"
								: isInProgress
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground"
						)}
					>
						{isCompleted ? (
							<Check className="h-5 w-5 text-primary" />
						) : (
							lessonNumber
						)}
					</div>

					{/* Title */}
					<div className="flex-1 min-w-0">
						<h3 className="font-medium text-foreground leading-snug line-clamp-2">
							{lesson.title}
						</h3>
					</div>
				</div>

				{/* Media types and duration */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex flex-wrap gap-2">
						{mediaTypes.map((type) => (
							<Badge
								key={type}
								variant="secondary"
								className="text-xs bg-muted text-muted-foreground"
							>
								{type}
							</Badge>
						))}
					</div>
					{durationText && (
						<span className="text-sm text-muted-foreground">
							{durationText}
						</span>
					)}
				</div>

				{/* Progress bar (only for in-progress lessons) */}
				{isInProgress && (
					<div className="mb-4">
						<Progress value={progressPercentage} className="h-1.5" />
					</div>
				)}

				{/* CTA */}
				<Button
					asChild
					variant={isCompleted ? "outline" : "default"}
					size="sm"
					className="w-full"
				>
					<Link
						href={`/course/${courseSlug}/lesson/${lesson.slug}`}
						prefetch={false}
					>
						<Play className="h-3 w-3 mr-1.5" />
						{getButtonText()}
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
