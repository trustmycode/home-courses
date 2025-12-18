import { loadCourses } from "@/lib/content";
import { Header } from "@/components/layout/Header";
import { CourseCard } from "@/components/course/CourseCard";
import { getCourseProgressDirect } from "@/lib/progress-server";

export const dynamic = "force-dynamic";

export default async function Page() {
	const courses = await loadCourses();

	// Загружаем прогресс для всех курсов параллельно
	const coursesWithProgress = await Promise.all(
		courses.map(async (course) => {
			const progress = await getCourseProgressDirect(course.slug);
			return { course, progress };
		})
	);

	return (
		<div className="min-h-screen bg-background">
			<Header />

			<main className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
				{/* Page header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Курсы
					</h1>
					<p className="text-muted-foreground">
						Выберите курс и продолжите с того места, где остановились.
					</p>
				</div>

				{/* Course grid */}
				{courses.length === 0 ? (
					<div className="text-center py-16">
						<h3 className="text-lg font-medium text-foreground mb-2">
							Пока нет курсов
						</h3>
						<p className="text-sm text-muted-foreground max-w-sm mx-auto">
							Добавьте папку курса и файлы контента в репозиторий.
						</p>
					</div>
				) : (
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{coursesWithProgress.map(({ course, progress }) => (
							<CourseCard
								key={course.slug}
								course={course}
								progress={progress ?? undefined}
							/>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
