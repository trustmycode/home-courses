#!/usr/bin/env node
/**
 * Исправляет структуру папок в standalone сборке для совместимости с OpenNext
 * 
 * Проблема: из-за outputFileTracingRoot Next.js создает структуру:
 *   .next/standalone/web/apps/home-courses/.next/server/
 * 
 * А OpenNext ожидает:
 *   .next/standalone/.next/server/
 * 
 * Решение: создаем симлинк или копируем структуру в ожидаемое место
 */

import { existsSync, mkdirSync, symlinkSync, cpSync, rmSync, readdirSync, statSync, lstatSync, readlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const standaloneDir = join(projectRoot, ".next", "standalone");

// Функция для поиска .next директории в standalone
function findNextDir(startPath, expectedPath, maxDepth = 5, currentDepth = 0) {
	if (!existsSync(startPath) || currentDepth > maxDepth) {
		return null;
	}

	// Проверяем текущую директорию
	const nextPath = join(startPath, ".next");
	if (existsSync(nextPath) && statSync(nextPath).isDirectory()) {
		// Пропускаем целевой путь (куда мы копируем)
		if (nextPath === expectedPath) {
			// Продолжаем поиск в поддиректориях
		} else {
			const serverPath = join(nextPath, "server", "pages-manifest.json");
			if (existsSync(serverPath)) {
				return nextPath;
			}
		}
	}

	// Рекурсивно ищем в поддиректориях
	try {
		const entries = readdirSync(startPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				const found = findNextDir(join(startPath, entry.name), expectedPath, maxDepth, currentDepth + 1);
				if (found) {
					return found;
				}
			}
		}
	} catch (error) {
		// Игнорируем ошибки доступа
	}

	return null;
}

// Проверяем существование standalone директории
if (!existsSync(standaloneDir)) {
	console.warn("⚠️  Standalone директория не найдена.");
	console.warn("   Возможно, сборка еще не завершена или output: 'standalone' не используется.");
	console.warn("   Пропускаем исправление пути.");
	process.exit(0); // Не критичная ошибка, просто пропускаем
}

// Определяем ожидаемый путь (куда мы будем копировать)
const expectedPath = join(standaloneDir, ".next");

// Находим реальную структуру динамически (исключая целевой путь)
const actualPath = findNextDir(standaloneDir, expectedPath);

console.log("🔧 Исправление структуры standalone для OpenNext...");

// Если actualPath не найден, возможно, файлы уже скопированы
if (!actualPath) {
	if (existsSync(expectedPath)) {
		const serverPath = join(expectedPath, "server", "pages-manifest.json");
		if (existsSync(serverPath)) {
			console.log(`   Структура уже исправлена (файлы уже скопированы), пропускаем`);
			console.log("✅ Структура уже исправлена для OpenNext");
			process.exit(0);
		}
	}
	console.warn("⚠️  .next директория не найдена в standalone.");
	console.warn("   Возможно, outputFileTracingRoot не используется или структура изменилась.");
	console.warn("   Пропускаем исправление пути.");
	process.exit(0);
}

console.log(`   Реальный путь: ${actualPath}`);
console.log(`   Ожидаемый путь: ${expectedPath}`);

// Создаем директорию для ожидаемого пути
if (!existsSync(dirname(expectedPath))) {
	mkdirSync(dirname(expectedPath), { recursive: true });
}

// Если ожидаемый путь уже существует, проверяем, не является ли он уже правильным
if (existsSync(expectedPath)) {
	const serverPath = join(expectedPath, "server", "pages-manifest.json");
	if (existsSync(serverPath)) {
		// Проверяем, является ли это симлинком
		try {
			const stats = lstatSync(expectedPath);
			if (stats.isSymbolicLink()) {
				// Проверяем, куда ведет симлинк
				const linkTarget = readlinkSync(expectedPath);
				const resolvedTarget = join(dirname(expectedPath), linkTarget);
				// Нормализуем пути для сравнения
				const normalizedActual = join(actualPath);
				const normalizedTarget = join(resolvedTarget);
				if (normalizedTarget === normalizedActual || linkTarget === actualPath) {
					console.log(`   Симлинк уже существует и указывает на правильный путь, пропускаем`);
					console.log("✅ Структура уже исправлена для OpenNext");
					process.exit(0);
				}
			} else {
				// Это директория (уже скопирована), проверяем, что она правильная
				// Если actualPath указывает на expectedPath, значит это уже скопированная версия
				if (actualPath === expectedPath) {
					console.log(`   Структура уже исправлена (файлы уже скопированы), пропускаем`);
					console.log("✅ Структура уже исправлена для OpenNext");
					process.exit(0);
				}
			}
		} catch (error) {
			// Если не можем проверить, продолжаем
		}
	}
	// Если это не правильный путь, удаляем
	console.log(`   Удаление существующего пути: ${expectedPath}`);
	rmSync(expectedPath, { recursive: true, force: true });
}

// В CI/CD окружении лучше копировать, чтобы избежать проблем с симлинками
// Используем копирование вместо симлинка для надежности
// Также проверяем переменные окружения Cloudflare Pages
const useCopy = process.env.CI === "true" || process.env.CF_PAGES === "1" || process.env.CF_PAGES_BRANCH !== undefined;

if (useCopy) {
	console.log(`   Копирование файлов (CI/CD режим)...`);
	cpSync(actualPath, expectedPath, { recursive: true });
	console.log("✓ Файлы скопированы успешно");
} else {
	// Локально используем симлинк
	try {
		console.log(`   Создание симлинка...`);
		symlinkSync(actualPath, expectedPath, "dir");
		console.log("✓ Симлинк создан успешно");
	} catch (error) {
		if (error.code === "EPERM" || error.code === "ENOSYS" || error.code === "ELOOP") {
			// Если симлинки не поддерживаются или есть циклическая ссылка, копируем
			console.log(`   Симлинк не поддерживается, копируем файлы...`);
			cpSync(actualPath, expectedPath, { recursive: true });
			console.log("✓ Файлы скопированы успешно");
		} else {
			console.error(`❌ Ошибка при создании симлинка: ${error.message}`);
			process.exit(1);
		}
	}
}

console.log("✅ Структура исправлена для OpenNext");
