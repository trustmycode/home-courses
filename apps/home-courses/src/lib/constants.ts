/**
 * Константы приложения
 * Все конфигурационные значения собраны здесь для удобства управления
 */

// R2 Bucket
export const R2_BUCKET_NAME = "course-media";

// R2 Keys
export const R2_INDEX_KEY = "courses/index.json";

// Cache
export const CACHE_NAME_INDEX = "courses-index";
export const CACHE_KEY_INDEX = "https://internal/courses/index.json";
export const CACHE_MAX_AGE_INDEX = 300; // 5 минут

// Media Worker
export const MEDIA_WORKER_ORIGIN = "https://home-courses-media.ourhomecources.workers.dev";

// Paths
export const MEDIA_PATH_PREFIX = "/media";

