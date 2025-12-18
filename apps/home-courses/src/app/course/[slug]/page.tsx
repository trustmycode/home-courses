import { loadCourse, loadLessonAssets } from "@/lib/content";
import { Header } from "@/components/layout/Header";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LessonCard } from "@/components/lesson/LessonCard";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import Link from "next/link";
import { getLessonMediaTypes } from "@/lib/progress";
import { getCourseProgressDirect } from "@/lib/progress-server";

export const dynamic = "force-dynamic";

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
					<p className="text-muted-foreground">Курс не найден</p>
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

	// Загружаем прогресс курса
	const courseProgress = await getCourseProgressDirect(slug);

	// Загружаем типы материалов для каждого урока
	const lessonsWithMediaTypes = await Promise.all(
		sortedLessons.map(async (lesson) => {
			try {
				const assets = await loadLessonAssets(lesson.assetsKey);
				const mediaTypes = getLessonMediaTypes(assets);
				return { lesson, mediaTypes };
			} catch (error) {
				console.error(
					`Failed to load assets for lesson ${lesson.slug}:`,
					error
				);
				return { lesson, mediaTypes: [] };
			}
		})
	);

	// Находим первый незавершенный урок для кнопки "Продолжить"
	const getNextLessonSlug = () => {
		if (!courseProgress) return sortedLessons[0]?.slug;

		for (const lessonProgress of courseProgress.lessons || []) {
			if (!lessonProgress.completed) {
				const [, lessonSlug] = lessonProgress.lessonId.split("/");
				return lessonSlug;
			}
		}

		return sortedLessons[0]?.slug;
	};

	const nextLessonSlug = getNextLessonSlug();
	const progressPercentage = courseProgress?.progressPercentage ?? 0;

	return (
		<div className="min-h-screen bg-background">
			<Header />

			<main className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
				{/* Breadcrumbs */}
				<Breadcrumbs
					items={[
						{ label: "Курсы", href: "/" },
						{ label: course.title },
					]}
					className="mb-6"
				/>

				{/* Course header */}
				<div className="mb-8">
					<div className="flex items-start justify-between gap-4 mb-4">
						<div className="flex-1">
							<h1 className="text-3xl font-bold text-foreground mb-2">
								{course.title}
							</h1>
							{course.description && (
								<p className="text-muted-foreground">
									{course.description}
								</p>
							)}
						</div>
						{nextLessonSlug && (
							<Button asChild>
								<Link
									href={`/course/${slug}/lesson/${nextLessonSlug}`}
									prefetch={false}
								>
									<Play className="h-4 w-4 mr-2" />
									Продолжить
								</Link>
							</Button>
						)}
					</div>

					{/* Progress */}
					{courseProgress && (
						<div>
							<div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
								<span>Прогресс</span>
								<span>
									{Math.round(progressPercentage)}% завершено ·{" "}
									{courseProgress.completedLessons}/
									{courseProgress.totalLessons} уроков завершено
								</span>
							</div>
							<Progress value={progressPercentage} className="h-2" />
						</div>
					)}
				</div>

				{/* Lessons */}
				<div>
					<h2 className="text-xl font-semibold text-foreground mb-6">
						Все уроки
						<span className="text-muted-foreground font-normal ml-2">
							{sortedLessons.length}{" "}
							{sortedLessons.length === 1
								? "урок"
								: sortedLessons.length < 5
									? "урока"
									: "уроков"}
						</span>
					</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{lessonsWithMediaTypes.map(({ lesson, mediaTypes }, index) => {
							const lessonId = `${slug}/${lesson.slug}`;
							const lessonProgress = courseProgress?.lessons?.find(
								(l) => l.lessonId === lessonId
							);

							return (
								<LessonCard
									key={lesson.slug}
									lesson={lesson}
									courseSlug={course.slug}
									lessonNumber={index + 1}
									progress={lessonProgress}
									mediaTypes={mediaTypes}
								/>
							);
						})}
					</div>
				</div>
			</main>
		</div>
	);
}
