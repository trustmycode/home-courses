#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

// Параметры скрипта
const DEFAULT_R2_BUCKET = "course-media";
const DEFAULT_COURSE_SLUG = "01-anna-vladimirovna-stop-trevoga";
const DEFAULT_SOURCE_DIR = "../Анна Владимировна. Стоп Тревога";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const bucket = arg("bucket", DEFAULT_R2_BUCKET);
const courseSlug = arg("course-slug", DEFAULT_COURSE_SLUG);
const sourceDirArg = arg("source-dir", DEFAULT_SOURCE_DIR);

// Полные пути
const sourceDir = path.resolve(repoRoot, sourceDirArg);
const tempDir = path.join(repoRoot, ".temp-processed-videos");

// Проверка существования исходной папки
try {
  await fs.access(sourceDir);
} catch {
  console.error(`❌ Source directory not found: ${sourceDir}`);
  process.exit(1);
}

// Создание временной папки для обработанных файлов
await fs.mkdir(tempDir, { recursive: true });

// Функция для проверки наличия команды в системе
async function checkCommand(command) {
  return new Promise((resolve) => {
    const p = spawn("which", [command], { stdio: "ignore" });
    p.on("exit", (code) => resolve(code === 0));
  });
}

// Проверка наличия ffmpeg
const hasFfmpeg = await checkCommand("ffmpeg");
if (!hasFfmpeg) {
  console.error("❌ ffmpeg not found in PATH. Please install ffmpeg first.");
  process.exit(1);
}

// Функция для поиска всех MP4 файлов
async function findMp4Files(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Рекурсивно ищем в подпапках
      const subFiles = await findMp4Files(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp4")) {
      files.push(fullPath);
    }
  }

  return files;
}

// Функция для извлечения номера урока из имени файла
// Пример: "01-lesson-neyrokarta-trevogi-tehnika.mp4" -> "01-lesson"
function extractLessonSlug(filename) {
  const basename = path.basename(filename, ".mp4");
  // Ищем паттерн XX-lesson-*** где XX - цифры
  const match = basename.match(/^(\d{2}-lesson)/);
  if (match) {
    return match[1];
  }
  // Если паттерн не найден, пытаемся извлечь первые два дефиса
  const parts = basename.split("-");
  if (parts.length >= 2 && /^\d{2}$/.test(parts[0])) {
    return `${parts[0]}-${parts[1]}`;
  }
  throw new Error(`Cannot extract lesson slug from filename: ${filename}`);
}

// Функция для обработки видео через ffmpeg
async function processVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Processing: ${path.basename(inputPath)}`);
    const p = spawn(
      "ffmpeg",
      [
        "-i",
        inputPath,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        outputPath,
        "-y", // Перезаписывать выходной файл если существует
      ],
      { stdio: "inherit" }
    );

    p.on("exit", (code) => {
      if (code === 0) {
        console.log(`✅ Processed: ${path.basename(outputPath)}`);
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    p.on("error", (err) => {
      reject(new Error(`ffmpeg error: ${err.message}`));
    });
  });
}

// Функция для загрузки файла в R2
async function uploadToR2(filePath, r2Key) {
  return new Promise((resolve, reject) => {
    console.log(`⬆️  Uploading to R2: ${bucket}/${r2Key}`);
    const p = spawn(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${bucket}/${r2Key}`,
        "--file",
        filePath,
        "--content-type",
        "video/mp4",
        "--remote",
      ],
      { stdio: "inherit" }
    );

    p.on("exit", (code) => {
      if (code === 0) {
        console.log(`✅ Uploaded: ${r2Key}`);
        resolve();
      } else {
        reject(new Error(`wrangler exited with code ${code}`));
      }
    });

    p.on("error", (err) => {
      reject(new Error(`wrangler error: ${err.message}`));
    });
  });
}

// Основная логика
console.log(`📁 Searching for MP4 files in: ${sourceDir}`);
const mp4Files = await findMp4Files(sourceDir);

if (mp4Files.length === 0) {
  console.log("⚠️  No MP4 files found in the source directory.");
  process.exit(0);
}

console.log(`📹 Found ${mp4Files.length} MP4 file(s)\n`);

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < mp4Files.length; i++) {
  const inputPath = mp4Files[i];
  const filename = path.basename(inputPath);

  try {
    // Извлекаем номер урока
    const lessonSlug = extractLessonSlug(filename);

    // Формируем пути
    const outputPath = path.join(tempDir, filename);
    const r2Key = `courses/${courseSlug}/${lessonSlug}/${filename}`;

    console.log(`\n[${i + 1}/${mp4Files.length}] Processing: ${filename}`);
    console.log(`   Lesson: ${lessonSlug}`);
    console.log(`   R2 path: ${r2Key}`);

    // Обрабатываем видео
    await processVideo(inputPath, outputPath);

    // Загружаем в R2
    await uploadToR2(outputPath, r2Key);

    successCount++;
  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
    errorCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Successfully processed: ${successCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log(`\n💾 Processed files are saved in: ${tempDir}`);

if (errorCount > 0) {
  process.exit(1);
}
