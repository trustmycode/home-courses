#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

// R2 Bucket name - можно переопределить через --bucket
const DEFAULT_R2_BUCKET = "course-media";
const bucket = arg("bucket", DEFAULT_R2_BUCKET);
const courseSlug = arg("course");
const lessonSlug = arg("lesson");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
// Базовый URL для медиа (из env или параметра)
const MEDIA_BASE_URL = arg("media-base-url") || process.env.MEDIA_BASE_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "";

if (!courseSlug || !lessonSlug) {
  console.error(`Usage:
node tools/render-lesson.mjs --course <courseSlug> --lesson <lessonSlug> [--bucket <r2BucketName>] [--media-base-url <url>]

Example:
node tools/render-lesson.mjs --course 01-anna-vladimirovna-stop-trevoga --lesson 01-lesson
node tools/render-lesson.mjs --course 01-anna-vladimirovna-stop-trevoga --lesson 01-lesson --media-base-url https://home-courses-media.ourhomecources.workers.dev`);
  process.exit(1);
}

// Где лежат исходники на диске (редактируешь локально)
// Файлы называются с префиксом урока: <lessonSlug>.mdx, assets.json (локально)
// В R2: <lessonSlug>.html, <lessonSlug>.mdx, <prefix>-assets.json (где prefix - первые цифры из lessonSlug)
const srcDir = path.join(repoRoot, "content-src", "courses", courseSlug, lessonSlug);
const mdxPath = path.join(srcDir, `${lessonSlug}.mdx`);
// Локально используем assets.json, в R2 будет <prefix>-assets.json
const assetsPath = path.join(srcDir, "assets.json");

// Куда кладём результат на диск
const outDir = path.join(repoRoot, ".generated", "courses", courseSlug, lessonSlug);
const outHtmlPath = path.join(outDir, `${lessonSlug}.html`);

// Куда в R2 (с префиксом урока)
const r2HtmlKey = `courses/${courseSlug}/${lessonSlug}/${lessonSlug}.html`;

// Проверяем существование файлов
try {
  await fs.access(mdxPath);
} catch {
  console.error(`❌ MDX file not found: ${mdxPath}`);
  process.exit(1);
}

try {
  await fs.access(assetsPath);
} catch {
  console.error(`❌ Assets file not found: ${assetsPath}`);
  process.exit(1);
}

const assets = JSON.parse(await fs.readFile(assetsPath, "utf-8"));
const assetsMap = assets.assets ?? {};

function mustAsset(id) {
  const a = assetsMap[id];
  if (!a) throw new Error(`assetId "${id}" not found in assets.json`);
  return a;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const mdxRaw = await fs.readFile(mdxPath, "utf-8");
const { content: rawContent } = matter(mdxRaw); // выкинули frontmatter (--- ... ---)

// Обрабатываем JSX компоненты перед компиляцией - заменяем их на HTML
let content = rawContent;

// Защита: не заменять внутри code fences (``` или `)
// Разделяем контент на части: внутри code fences и вне их
const codeFenceRegex = /(```[\s\S]*?```|`[^`]+`)/g;
const parts = [];
let lastIndex = 0;
let match;

while ((match = codeFenceRegex.exec(content)) !== null) {
  if (match.index > lastIndex) {
    parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
  }
  parts.push({ type: "code", content: match[0] });
  lastIndex = match.index + match[0].length;
}
if (lastIndex < content.length) {
  parts.push({ type: "text", content: content.slice(lastIndex) });
}

// Если нет code fences, создаем один текстовый part
if (parts.length === 0) {
  parts.push({ type: "text", content: content });
}

// Первый проход: найти primary video (первое Video в текстовых частях)
let primaryAssetId = null;
for (const part of parts) {
  if (part.type === "text") {
    const primaryVideoMatch = part.content.match(/<Video\b[^>]*\bassetId="([^"]+)"/);
    if (primaryVideoMatch) {
      primaryAssetId = primaryVideoMatch[1];
      break;
    }
  }
}

// Второй проход: заменить Video теги только в текстовых частях
const processedPartsVideo = parts.map(part => {
  if (part.type === "code") return part.content;
  
  return part.content.replace(/<Video\b([^>]*)\s*\/>/gs, (match, attrs) => {
    const assetId = /assetId="([^"]+)"/.exec(attrs)?.[1];
    const title = /title="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const showTitle = /\bshowTitle\b/.test(attrs);

    if (!assetId) return match;
    const a = mustAsset(assetId);

    const isPrimary = primaryAssetId === assetId;
    const safeTitle = escapeHtml(title);

    const mediaUrl = MEDIA_BASE_URL ? `${MEDIA_BASE_URL}/media/${a.r2Key}` : `/media/${a.r2Key}`;
    // Добавляем пустые строки вокруг figure для правильного парсинга marked
    return `\n\n<figure class="asset asset-video my-6" data-asset-id="${assetId}" data-asset-type="video" data-required="${isPrimary ? "true" : "false"}">
      ${showTitle ? `<figcaption class="asset-title mb-2">${safeTitle}</figcaption>` : ""}
      <video controls preload="metadata" data-asset-id="${assetId}" src="${mediaUrl}"></video>
    </figure>\n\n`;
  });
});

content = processedPartsVideo.join("");

// Пересоздаём parts для Audio (так как content изменился)
const partsAudio = [];
lastIndex = 0;
const codeFenceRegexAudio = /(```[\s\S]*?```|`[^`]+`)/g;

while ((match = codeFenceRegexAudio.exec(content)) !== null) {
  if (match.index > lastIndex) {
    partsAudio.push({ type: "text", content: content.slice(lastIndex, match.index) });
  }
  partsAudio.push({ type: "code", content: match[0] });
  lastIndex = match.index + match[0].length;
}
if (lastIndex < content.length) {
  partsAudio.push({ type: "text", content: content.slice(lastIndex) });
}
if (partsAudio.length === 0) {
  partsAudio.push({ type: "text", content: content });
}

// Заменяем <Audio ... /> на HTML (аналогично, без primary, с защитой от code fences)
const processedPartsAudio = partsAudio.map(part => {
  if (part.type === "code") return part.content;
  
  return part.content.replace(/<Audio\b([^>]*)\s*\/>/gs, (match, attrs) => {
    const assetId = /assetId="([^"]+)"/.exec(attrs)?.[1];
    const title = /title="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const showTitle = /\bshowTitle\b/.test(attrs);

    if (!assetId) return match;
    const a = mustAsset(assetId);
    const safeTitle = escapeHtml(title);

    const mediaUrl = MEDIA_BASE_URL ? `${MEDIA_BASE_URL}/media/${a.r2Key}` : `/media/${a.r2Key}`;
    // Добавляем пустые строки вокруг figure для правильного парсинга marked
    return `\n\n<figure class="asset asset-audio my-6" data-asset-id="${assetId}" data-asset-type="audio">
      ${showTitle ? `<figcaption class="asset-title mb-2">${safeTitle}</figcaption>` : ""}
      <audio controls preload="metadata" data-asset-id="${assetId}" src="${mediaUrl}"></audio>
    </figure>\n\n`;
  });
});

content = processedPartsAudio.join("");

// Пересоздаём parts для Download
const partsDownload = [];
lastIndex = 0;
const codeFenceRegexDownload = /(```[\s\S]*?```|`[^`]+`)/g;

while ((match = codeFenceRegexDownload.exec(content)) !== null) {
  if (match.index > lastIndex) {
    partsDownload.push({ type: "text", content: content.slice(lastIndex, match.index) });
  }
  partsDownload.push({ type: "code", content: match[0] });
  lastIndex = match.index + match[0].length;
}
if (lastIndex < content.length) {
  partsDownload.push({ type: "text", content: content.slice(lastIndex) });
}
if (partsDownload.length === 0) {
  partsDownload.push({ type: "text", content: content });
}

// Заменяем <Download ... /> на HTML (без href="#", с защитой от code fences)
const processedPartsDownload = partsDownload.map(part => {
  if (part.type === "code") return part.content;
  
  return part.content.replace(/<Download\b([^>]*)\s*\/>/gs, (match, attrs) => {
    const assetId = /assetId="([^"]+)"/.exec(attrs)?.[1];
    const title = /title="([^"]+)"/.exec(attrs)?.[1] ?? "";

    if (!assetId) return match;
    const a = mustAsset(assetId);
    const safeTitle = escapeHtml(title);

    const mediaUrl = MEDIA_BASE_URL ? `${MEDIA_BASE_URL}/media/${a.r2Key}` : `/media/${a.r2Key}`;
    // Добавляем пустые строки вокруг div для правильного парсинга marked
    return `\n\n<div class="asset asset-download mt-4 mb-2" data-asset-id="${assetId}" data-asset-type="pdf">
      <a class="download-link" data-asset-id="${assetId}" href="${mediaUrl}" target="_blank" rel="noreferrer">${safeTitle}</a>
    </div>\n\n`;
  });
});

content = processedPartsDownload.join("");

// Нормализуем контент: убеждаемся, что заголовки правильно отделены от HTML-тегов
// Добавляем пустую строку перед HTML-блоками после заголовков, если её нет
content = content.replace(/(\n###? [^\n]+)\n*(<figure|<div class="asset)/g, '$1\n\n$2');

// Убеждаемся, что figure теги правильно отделены пустыми строками для правильного парсинга
// Это помогает marked правильно обработать HTML теги внутри figure
content = content.replace(/(<figure[^>]*>)\s*(<video|<audio)/g, '$1\n      $2');
content = content.replace(/(<\/video>|<\/audio>)\s*(<\/figure>)/g, '$1\n    $2');

// Убеждаемся, что заголовки в начале файла правильно распознаются (если файл начинается с заголовка)
if (/^###? /.test(content.trim())) {
  // Файл начинается с заголовка - это нормально, marked должен его распознать
}

// Используем marked для конвертации markdown в HTML
marked.setOptions({
  breaks: true,
  gfm: true,
});

let html = marked.parse(content);

// Постобработка: исправить экранированные video/audio теги внутри figure
// Marked может экранировать HTML теги и оборачивать их в <pre><code>, нужно их распаковать

// Паттерн: figure содержит <pre><code> с экранированными video/audio тегами
// Обрабатываем случаи, когда весь контент внутри figure экранирован
html = html.replace(
  /<figure([^>]*)>\s*<pre><code>([\s\S]*?)<\/code><\/pre>\s*<\/figure>/g,
  (match, figureAttrs, codeContent) => {
    // Проверяем, содержит ли codeContent экранированные video/audio теги
    if (codeContent.includes('&lt;video') || codeContent.includes('&lt;audio') || codeContent.includes('&lt;/figure')) {
      // Распаковываем все экранированные HTML сущности
      let unescaped = codeContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Если unescaped содержит закрывающий тег </figure>, удаляем его (он уже есть снаружи)
      unescaped = unescaped.replace(/<\/figure>\s*$/, '').trim();
      
      // Форматируем правильно с отступами
      const lines = unescaped.split('\n').map(line => line.trim()).filter(line => line);
      const formatted = lines.map(line => `      ${line}`).join('\n');
      
      return `<figure${figureAttrs}>\n${formatted}\n    </figure>`;
    }
    return match; // Если не содержит video/audio, оставляем как есть
  }
);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outHtmlPath, html, "utf-8");

console.log(`✅ Rendered: ${outHtmlPath}`);
console.log(`⬆️  Uploading to R2: ${bucket}/${r2HtmlKey}`);

await new Promise((resolve, reject) => {
  const p = spawn(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${r2HtmlKey}`,
      "--file",
      outHtmlPath,
      "--content-type",
      "text/html; charset=utf-8",
      "--remote", // Загружаем в удаленный R2, а не в локальный
    ],
    { stdio: "inherit" }
  );
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`wrangler exited ${code}`))));
});

console.log("✅ Uploaded.");
