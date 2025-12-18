"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type LessonProgressResponse = {
	courseSlug: string;
	lessonSlug: string;
	isCompleted: boolean;
	timeSpentSec: number;
	updatedAtMs: number;
	mediaPositions: Array<{
		assetId: string;
		assetType: "video" | "audio";
		positionSec: number;
		updatedAtMs: number;
	}>;
};

interface LessonContentProps {
	html: string;
	courseSlug: string;
	lessonSlug: string;
	initialProgress?: LessonProgressResponse | null;
}

type AssetsById = Record<string, { url: string; kind: string }>;

/**
 * Хук для трекинга прогресса медиа
 */
function useMediaProgress(
	courseSlug: string,
	lessonSlug: string,
	initialProgress?: LessonProgressResponse | null
) {
	const pendingPositions = useRef<Map<string, number>>(new Map());
	const timeSpentDelta = useRef<number>(0);
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isTrackingTime = useRef<boolean>(false);
	const timeTrackingStart = useRef<number>(0);
	const [isCompleted, setIsCompleted] = useState(
		initialProgress?.isCompleted ?? false
	);

	const flushProgress = useCallback(async () => {
		if (pendingPositions.current.size === 0 && timeSpentDelta.current === 0) {
			return;
		}

		const positions: Array<{
			assetId: string;
			assetType: "video" | "audio";
			positionSec: number;
			clientUpdatedAtMs: number;
		}> = [];

		for (const [assetId, positionSec] of pendingPositions.current.entries()) {
			// Определяем тип по элементу в DOM
			const element = document.querySelector(
				`[data-asset-id="${assetId}"]`
			) as HTMLVideoElement | HTMLAudioElement | null;
			if (element) {
				const assetType =
					element.tagName.toLowerCase() === "video" ? "video" : "audio";
				positions.push({
					assetId,
					assetType,
					positionSec: Math.floor(positionSec),
					clientUpdatedAtMs: Date.now(),
				});
			}
		}

		const timeDelta = Math.floor(timeSpentDelta.current);
		timeSpentDelta.current = 0;
		pendingPositions.current.clear();

		try {
			const payload = {
				courseSlug,
				lessonSlug,
				timeSpentSecDelta: timeDelta,
				mediaPositions: positions,
				isCompleted,
			};

			// Используем fetch с keepalive для надежности при закрытии страницы
			// sendBeacon не всегда корректно обрабатывает JSON на сервере
			await fetch("/api/progress/lesson", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				keepalive: true,
			});
		} catch (error) {
			console.error("Failed to save progress:", error);
		}
	}, [courseSlug, lessonSlug, isCompleted]);

	// Таймер flush каждые 20 секунд
	useEffect(() => {
		flushTimer.current = setInterval(() => {
			if (pendingPositions.current.size > 0 || timeSpentDelta.current > 0) {
				flushProgress();
			}
		}, 20000); // 20 секунд

		return () => {
			if (flushTimer.current) {
				clearInterval(flushTimer.current);
				flushTimer.current = null;
			}
		};
	}, [flushProgress]);

	// Слушатели для flush на выход
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushProgress();
			}
		};

		const handlePageHide = () => {
			flushProgress();
		};

		window.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pagehide", handlePageHide);

		return () => {
			window.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pagehide", handlePageHide);
		};
	}, [flushProgress]);

	// Трекинг времени просмотра (wall-clock)
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;

		const startTracking = () => {
			if (!isTrackingTime.current) {
				isTrackingTime.current = true;
				timeTrackingStart.current = Date.now();
			}
		};

		const stopTracking = () => {
			if (isTrackingTime.current) {
				isTrackingTime.current = false;
				const elapsed = (Date.now() - timeTrackingStart.current) / 1000;
				timeSpentDelta.current += elapsed;
				timeTrackingStart.current = 0;
			}
		};

		// Проверяем, есть ли активные медиа
		const checkActiveMedia = () => {
			const container = document.querySelector('[data-lesson-content]');
			if (!container) return;

			const videos = container.querySelectorAll<HTMLVideoElement>("video");
			const audios = container.querySelectorAll<HTMLAudioElement>("audio");
			let hasPlaying = false;

			for (const media of [...videos, ...audios]) {
				if (!media.paused && !media.ended && media.currentTime > 0) {
					hasPlaying = true;
					break;
				}
			}

			if (hasPlaying) {
				startTracking();
			} else {
				stopTracking();
			}
		};

		// Проверяем каждую секунду
		interval = setInterval(checkActiveMedia, 1000);
		checkActiveMedia(); // Первая проверка

		return () => {
			if (interval) {
				clearInterval(interval);
			}
			stopTracking();
		};
	}, []);

	return {
		updatePosition: (assetId: string, positionSec: number) => {
			pendingPositions.current.set(assetId, positionSec);
		},
		markCompleted: async () => {
			setIsCompleted(true);
			await fetch("/api/progress/lesson", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					courseSlug,
					lessonSlug,
					isCompleted: true,
				}),
			});
		},
		isCompleted,
	};
}

export function LessonContent({
	html,
	courseSlug,
	lessonSlug,
	initialProgress,
}: LessonContentProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [assetsById, setAssetsById] = useState<AssetsById | null>(null);
	const [urlsLoaded, setUrlsLoaded] = useState(false);
	const { updatePosition, markCompleted, isCompleted } = useMediaProgress(
		courseSlug,
		lessonSlug,
		initialProgress
	);

	// Загружаем все signed URLs одним запросом
	useEffect(() => {
		const loadUrls = async () => {
			try {
				const response = await fetch(
					`/api/media-urls?courseSlug=${encodeURIComponent(
						courseSlug
					)}&lessonSlug=${encodeURIComponent(lessonSlug)}`
				);
				if (!response.ok) {
					console.error("Failed to load media URLs:", response.statusText);
					return;
				}

				const data = (await response.json()) as { assetsById: AssetsById };
				setAssetsById(data.assetsById);
				setUrlsLoaded(true);
			} catch (error) {
				console.error("Error loading media URLs:", error);
			}
		};

		loadUrls();
	}, [courseSlug, lessonSlug]);

	// Применяем URLs и восстанавливаем позиции
	useEffect(() => {
		if (!containerRef.current || !urlsLoaded || !assetsById) return;

		const container = containerRef.current;

		// Ищем все элементы по data-asset-id
		const videoElements = container.querySelectorAll<HTMLVideoElement>(
			"video[data-asset-id]"
		);
		const audioElements = container.querySelectorAll<HTMLAudioElement>(
			"audio[data-asset-id]"
		);
		const downloadLinks = container.querySelectorAll<HTMLAnchorElement>(
			"a.download-link[data-asset-id]"
		);

		const cleanupFunctions: Array<() => void> = [];

		// Применяем URLs к видео
		videoElements.forEach((video) => {
			const assetId = video.getAttribute("data-asset-id");
			if (!assetId) return;

			const asset = assetsById[assetId];
			if (!asset) {
				console.warn(`Asset not found: ${assetId}`);
				return;
			}

			video.src = asset.url;

			// Восстанавливаем позицию из initialProgress
			if (initialProgress) {
				const mediaPos = initialProgress.mediaPositions.find(
					(mp) => mp.assetId === assetId
				);
				if (mediaPos && mediaPos.positionSec > 0) {
					const handleLoadedMetadata = () => {
						if (video.duration && !isNaN(video.duration)) {
							video.currentTime = Math.min(
								mediaPos.positionSec,
								video.duration - 1
							);
						}
					};
					video.addEventListener("loadedmetadata", handleLoadedMetadata, {
						once: true,
					});
					cleanupFunctions.push(() => {
						video.removeEventListener("loadedmetadata", handleLoadedMetadata);
					});
				}
			}

			// Трекинг позиции
			const handleTimeUpdate = () => {
				updatePosition(assetId, video.currentTime);
			};

			video.addEventListener("timeupdate", handleTimeUpdate);
			cleanupFunctions.push(() => {
				video.removeEventListener("timeupdate", handleTimeUpdate);
			});

			// Completion для primary video
			const isPrimary =
				video.closest("figure")?.getAttribute("data-required") === "true";
			if (isPrimary && !isCompleted) {
				const handleTimeUpdateForCompletion = () => {
					if (
						video.duration &&
						!isNaN(video.duration) &&
						video.duration > 0
					) {
						const progress = video.currentTime / video.duration;
						if (progress >= 0.95) {
							markCompleted();
						}
					}
				};

				const handleEnded = () => {
					markCompleted();
				};

				video.addEventListener("timeupdate", handleTimeUpdateForCompletion);
				video.addEventListener("ended", handleEnded, { once: true });
				cleanupFunctions.push(() => {
					video.removeEventListener("timeupdate", handleTimeUpdateForCompletion);
					video.removeEventListener("ended", handleEnded);
				});
			}
		});

		// Применяем URLs к аудио
		audioElements.forEach((audio) => {
			const assetId = audio.getAttribute("data-asset-id");
			if (!assetId) return;

			const asset = assetsById[assetId];
			if (!asset) {
				console.warn(`Asset not found: ${assetId}`);
				return;
			}

			audio.src = asset.url;

			// Восстанавливаем позицию из initialProgress
			if (initialProgress) {
				const mediaPos = initialProgress.mediaPositions.find(
					(mp) => mp.assetId === assetId
				);
				if (mediaPos && mediaPos.positionSec > 0) {
					const handleLoadedMetadata = () => {
						if (audio.duration && !isNaN(audio.duration)) {
							audio.currentTime = Math.min(
								mediaPos.positionSec,
								audio.duration - 1
							);
						}
					};
					audio.addEventListener("loadedmetadata", handleLoadedMetadata, {
						once: true,
					});
					cleanupFunctions.push(() => {
						audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
					});
				}
			}

			// Трекинг позиции
			const handleTimeUpdate = () => {
				updatePosition(assetId, audio.currentTime);
			};

			audio.addEventListener("timeupdate", handleTimeUpdate);
			cleanupFunctions.push(() => {
				audio.removeEventListener("timeupdate", handleTimeUpdate);
			});
		});

		// Применяем URLs к download links
		downloadLinks.forEach((link) => {
			const assetId = link.getAttribute("data-asset-id");
			if (!assetId) return;

			const asset = assetsById[assetId];
			if (!asset) {
				console.warn(`Asset not found: ${assetId}`);
				return;
			}

			link.href = asset.url;
			// Убираем disabled классы
			link.classList.remove("pointer-events-none", "opacity-50");
			link.removeAttribute("aria-disabled");

			// Стилизуем ссылку как кнопку
			if (!link.classList.contains("download-button-styled")) {
				link.classList.add(
					"download-button-styled",
					"inline-flex",
					"items-center",
					"justify-center",
					"gap-2",
					"whitespace-nowrap",
					"rounded-md",
					"text-sm",
					"font-medium",
					"ring-offset-background",
					"transition-colors",
					"focus-visible:outline-none",
					"focus-visible:ring-2",
					"focus-visible:ring-ring",
					"focus-visible:ring-offset-2",
					"disabled:pointer-events-none",
					"disabled:opacity-50",
					"bg-primary",
					"text-primary-foreground",
					"hover:bg-primary/90",
					"h-10",
					"px-4",
					"py-2",
					"no-underline"
				);
			}
		});

		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup());
		};
	}, [html, urlsLoaded, assetsById, initialProgress, updatePosition, markCompleted, isCompleted, courseSlug, lessonSlug]);

	return (
		<div className="max-w-3xl mx-auto" ref={containerRef} data-lesson-content>
			<article
				className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}
