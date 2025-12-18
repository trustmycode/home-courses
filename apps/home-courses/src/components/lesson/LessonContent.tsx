"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MediaErrorToast } from "./MediaErrorToast";

type LessonProgressResponse = {
	lessonId: string;
	assets: Record<
		string,
		{
			positionSeconds: number;
			durationSeconds: number | null;
			completed: boolean;
			updatedAt: string;
		}
	>;
};

interface LessonContentProps {
	html: string;
	lessonId: string;
	initialProgress?: LessonProgressResponse | null;
}

/**
 * Хук для трекинга прогресса медиа
 */
function useMediaProgress(
	lessonId: string,
	initialProgress?: LessonProgressResponse | null
) {
	const pendingPositions = useRef<Map<string, number>>(new Map());
	const pendingDurations = useRef<Map<string, number>>(new Map());
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isTrackingTime = useRef<boolean>(false);
	const timeTrackingStart = useRef<number>(0);
	const timeSpentDelta = useRef<number>(0);

	const flushProgress = useCallback(async () => {
		if (pendingPositions.current.size === 0) {
			return;
		}

		const updates: Array<{
			assetId: string;
			positionSeconds: number;
			durationSeconds: number | null;
			completed: boolean;
		}> = [];

		for (const [assetId, positionSec] of pendingPositions.current.entries()) {
			const duration = pendingDurations.current.get(assetId) ?? null;
			const element = document.querySelector(
				`[data-asset-id="${assetId}"]`
			) as HTMLVideoElement | HTMLAudioElement | null;
			
			if (element) {
				const completed = element.ended || false;
				updates.push({
					assetId,
					positionSeconds: Math.floor(positionSec),
					durationSeconds: duration ? Math.floor(duration) : null,
					completed,
				});
			}
		}

		pendingPositions.current.clear();
		pendingDurations.current.clear();

		// Отправляем обновления (можно батчить, но для простоты отправляем по одному)
		for (const update of updates) {
			try {
				await fetch("/api/progress", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						lessonId,
						assetId: update.assetId,
						positionSeconds: update.positionSeconds,
						durationSeconds: update.durationSeconds,
						completed: update.completed,
					}),
					keepalive: true,
				});
			} catch (error) {
				console.error("Failed to save progress:", error);
			}
		}
	}, [lessonId]);

	// Таймер flush каждые 20 секунд
	useEffect(() => {
		flushTimer.current = setInterval(() => {
			if (pendingPositions.current.size > 0) {
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

		interval = setInterval(checkActiveMedia, 1000);
		checkActiveMedia();

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
		updateDuration: (assetId: string, durationSec: number) => {
			pendingDurations.current.set(assetId, durationSec);
		},
		markCompleted: async (assetId: string) => {
			await fetch("/api/progress", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					lessonId,
					assetId,
					completed: true,
				}),
			});
		},
	};
}

export function LessonContent({
	html,
	lessonId,
	initialProgress,
}: LessonContentProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [errorAssetId, setErrorAssetId] = useState<string | null>(null);
	const { updatePosition, updateDuration, markCompleted } = useMediaProgress(
		lessonId,
		initialProgress
	);

	// Восстанавливаем позиции и настраиваем трекинг
	useEffect(() => {
		if (!containerRef.current) return;

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

		// Настраиваем видео
		videoElements.forEach((video) => {
			const assetId = video.getAttribute("data-asset-id");
			if (!assetId) return;

			// Восстанавливаем позицию из initialProgress
			if (initialProgress?.assets[assetId]) {
				const progress = initialProgress.assets[assetId];
				if (progress.positionSeconds > 0) {
					const handleLoadedMetadata = () => {
						if (video.duration && !isNaN(video.duration) && video.duration > 0) {
							video.currentTime = Math.min(
								progress.positionSeconds,
								video.duration - 1
							);
							updateDuration(assetId, video.duration);
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

			// Сохраняем duration при загрузке
			const handleLoadedMetadata = () => {
				if (video.duration && !isNaN(video.duration) && video.duration > 0) {
					updateDuration(assetId, video.duration);
				}
			};
			video.addEventListener("loadedmetadata", handleLoadedMetadata);
			cleanupFunctions.push(() => {
				video.removeEventListener("loadedmetadata", handleLoadedMetadata);
			});

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
			if (isPrimary) {
				const handleTimeUpdateForCompletion = () => {
					if (
						video.duration &&
						!isNaN(video.duration) &&
						video.duration > 0
					) {
						const progress = video.currentTime / video.duration;
						if (progress >= 0.95) {
							markCompleted(assetId);
							video.removeEventListener(
								"timeupdate",
								handleTimeUpdateForCompletion
							);
						}
					}
				};

				video.addEventListener("timeupdate", handleTimeUpdateForCompletion);
				cleanupFunctions.push(() => {
					video.removeEventListener("timeupdate", handleTimeUpdateForCompletion);
				});

				video.addEventListener(
					"ended",
					() => {
						markCompleted(assetId);
					},
					{ once: true }
				);
			}

			// Обработка ошибок
			const handleError = () => {
				setErrorAssetId(assetId);
			};
			video.addEventListener("error", handleError);
			cleanupFunctions.push(() => {
				video.removeEventListener("error", handleError);
			});
		});

		// Настраиваем аудио
		audioElements.forEach((audio) => {
			const assetId = audio.getAttribute("data-asset-id");
			if (!assetId) return;

			// Восстанавливаем позицию из initialProgress
			if (initialProgress?.assets[assetId]) {
				const progress = initialProgress.assets[assetId];
				if (progress.positionSeconds > 0) {
					const handleLoadedMetadata = () => {
						if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
							audio.currentTime = Math.min(
								progress.positionSeconds,
								audio.duration - 1
							);
							updateDuration(assetId, audio.duration);
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

			// Сохраняем duration при загрузке
			const handleLoadedMetadata = () => {
				if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
					updateDuration(assetId, audio.duration);
				}
			};
			audio.addEventListener("loadedmetadata", handleLoadedMetadata);
			cleanupFunctions.push(() => {
				audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			});

			// Трекинг позиции
			const handleTimeUpdate = () => {
				updatePosition(assetId, audio.currentTime);
			};
			audio.addEventListener("timeupdate", handleTimeUpdate);
			cleanupFunctions.push(() => {
				audio.removeEventListener("timeupdate", handleTimeUpdate);
			});

			// Обработка ошибок
			const handleError = () => {
				setErrorAssetId(assetId);
			};
			audio.addEventListener("error", handleError);
			cleanupFunctions.push(() => {
				audio.removeEventListener("error", handleError);
			});
		});

		// Стилизуем download links
		downloadLinks.forEach((link) => {
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
	}, [html, initialProgress, updatePosition, updateDuration, markCompleted, lessonId]);

	const handleRetry = useCallback(() => {
		if (!errorAssetId || !containerRef.current) return;

		const element = containerRef.current.querySelector(
			`[data-asset-id="${errorAssetId}"]`
		) as HTMLVideoElement | HTMLAudioElement | null;

		if (element) {
			// Перезагружаем медиа
			const src = element.src;
			element.src = "";
			setTimeout(() => {
				element.src = src;
				element.load();
			}, 100);
			setErrorAssetId(null);
		}
	}, [errorAssetId]);

	return (
		<>
			<div
				className="max-w-3xl mx-auto"
				ref={containerRef}
				data-lesson-content
			>
				<article
					className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</div>
			{errorAssetId && (
				<MediaErrorToast assetId={errorAssetId} onRetry={handleRetry} />
			)}
		</>
	);
}
