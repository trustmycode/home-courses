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

import { existsSync, mkdirSync, symlinkSync, cpSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const standaloneDir = join(projectRoot, ".next", "standalone");

// Находим реальную структуру
const actualPath = join(standaloneDir, "web", "apps", "home-courses", ".next");
const expectedPath = join(standaloneDir, ".next");

console.log("🔧 Исправление структуры standalone для OpenNext...");
console.log(`   Реальный путь: ${actualPath}`);
console.log(`   Ожидаемый путь: ${expectedPath}`);

if (!existsSync(actualPath)) {
	console.error(`❌ Реальный путь не найден: ${actualPath}`);
	console.error("   Возможно, сборка еще не выполнена или outputFileTracingRoot не используется.");
	process.exit(1);
}

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
