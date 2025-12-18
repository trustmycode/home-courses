"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface MarkCompletedButtonProps {
	courseSlug: string;
	lessonSlug: string;
	initialCompleted: boolean;
}

export function MarkCompletedButton({
	courseSlug,
	lessonSlug,
	initialCompleted,
}: MarkCompletedButtonProps) {
	const [isCompleted, setIsCompleted] = useState(initialCompleted);
	const [isLoading, setIsLoading] = useState(false);

	const handleMarkCompleted = async () => {
		if (isCompleted || isLoading) return;

		setIsLoading(true);
		try {
			const response = await fetch("/api/progress/lesson", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					courseSlug,
					lessonSlug,
					isCompleted: true,
				}),
			});

			if (response.ok) {
				setIsCompleted(true);
			} else {
				console.error("Failed to mark lesson as completed");
			}
		} catch (error) {
			console.error("Error marking lesson as completed:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (isCompleted) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<CheckCircle2 className="h-4 w-4 text-primary" />
				<span>Урок пройден</span>
			</div>
		);
	}

	return (
		<Button
			onClick={handleMarkCompleted}
			disabled={isLoading}
			variant="outline"
			className="w-full sm:w-auto"
		>
			{isLoading ? "Сохранение..." : "Отметить пройдено"}
		</Button>
	);
}
