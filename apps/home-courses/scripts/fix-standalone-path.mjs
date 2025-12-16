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

import { existsSync, mkdirSync, symlinkSync, cpSync, rmSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const standaloneDir = join(projectRoot, ".next", "standalone");

// Функция для поиска .next директории в standalone
function findNextDir(startPath, maxDepth = 5, currentDepth = 0) {
	if (!existsSync(startPath) || currentDepth > maxDepth) {
		return null;
	}

	// Проверяем текущую директорию
	const nextPath = join(startPath, ".next");
	if (existsSync(nextPath) && statSync(nextPath).isDirectory()) {
		const serverPath = join(nextPath, "server", "pages-manifest.json");
		if (existsSync(serverPath)) {
			return nextPath;
		}
	}

	// Рекурсивно ищем в поддиректориях
	try {
		const entries = readdirSync(startPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				const found = findNextDir(join(startPath, entry.name), maxDepth, currentDepth + 1);
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

// Находим реальную структуру динамически
const actualPath = findNextDir(standaloneDir);
const expectedPath = join(standaloneDir, ".next");

console.log("🔧 Исправление структуры standalone для OpenNext...");

if (!actualPath) {
	console.warn("⚠️  .next директория не найдена в standalone.");
	console.warn("   Возможно, outputFileTracingRoot не используется или структура изменилась.");
	console.warn("   Пропускаем исправление пути.");
	process.exit(0); // Не критичная ошибка, просто пропускаем
}

console.log(`   Реальный путь: ${actualPath}`);
console.log(`   Ожидаемый путь: ${expectedPath}`);

// Создаем директорию для ожидаемого пути
if (!existsSync(dirname(expectedPath))) {
	mkdirSync(dirname(expectedPath), { recursive: true });
}

// Если ожидаемый путь уже существует, удаляем его
if (existsSync(expectedPath)) {
	console.log(`   Удаление существующего пути: ${expectedPath}`);
	rmSync(expectedPath, { recursive: true, force: true });
}

// Создаем симлинк (предпочтительно) или копируем
try {
	console.log(`   Создание симлинка...`);
	symlinkSync(actualPath, expectedPath, "dir");
	console.log("✓ Симлинк создан успешно");
} catch (error) {
	if (error.code === "EPERM" || error.code === "ENOSYS") {
		// Если симлинки не поддерживаются (Windows без прав администратора), копируем
		console.log(`   Симлинк не поддерживается, копируем файлы...`);
		cpSync(actualPath, expectedPath, { recursive: true });
		console.log("✓ Файлы скопированы успешно");
	} else {
		console.error(`❌ Ошибка при создании симлинка: ${error.message}`);
		process.exit(1);
	}
}

console.log("✅ Структура исправлена для OpenNext");
