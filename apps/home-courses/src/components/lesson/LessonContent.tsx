"use client";

import { useEffect, useRef } from "react";
import { AssetMeta } from "@/lib/content";

interface LessonContentProps {
  html: string;
  videoAsset?: AssetMeta;
  audioAsset?: AssetMeta;
}

/**
 * Извлекает r2Key из URL формата /media/{r2Key}
 */
function extractR2Key(src: string): string | null {
  const match = src.match(/^\/media\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Заменяет src атрибуты video/audio тегов и href ссылок на подписанные URL
 * Также скрывает дубликаты видео/аудио, которые уже отображаются в MediaPlayer
 */
async function replaceMediaUrls(container: HTMLElement, videoAsset?: AssetMeta, audioAsset?: AssetMeta) {
  // Собираем r2Key элементов, которые нужно скрыть
  const hiddenR2Keys = new Set<string>();
  if (videoAsset) hiddenR2Keys.add(videoAsset.r2Key);
  if (audioAsset) hiddenR2Keys.add(audioAsset.r2Key);
  
  // Скрываем видео/аудио, которые уже отображаются в MediaPlayer
  const allMediaElements = container.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio");
  const visibleMediaElements: (HTMLVideoElement | HTMLAudioElement)[] = [];
  
  allMediaElements.forEach((element) => {
    const src = element.getAttribute("src");
    if (src) {
      const r2Key = extractR2Key(src);
      if (r2Key && hiddenR2Keys.has(r2Key)) {
        // Скрываем это видео/аудио, так как оно уже в MediaPlayer
        const figure = element.closest("figure");
        if (figure) {
          figure.style.display = "none";
        } else {
          element.style.display = "none";
        }
        return; // Не добавляем в список для обработки
      }
    }
    visibleMediaElements.push(element);
  });
  
  // Обрабатываем только видимые video и audio элементы
  const mediaPromises = visibleMediaElements.map(async (element) => {
    const src = element.getAttribute("src");
    if (!src) return;
    
    const r2Key = extractR2Key(src);
    if (!r2Key) return; // Пропускаем, если это не наш формат
    
    try {
      const response = await fetch(`/api/media-url?key=${encodeURIComponent(r2Key)}`);
      if (!response.ok) {
        console.error(`Failed to get signed URL for ${r2Key}:`, response.statusText);
        return;
      }
      
      const data = (await response.json()) as { url: string };
      const signedUrl = data.url;
      element.src = signedUrl;
      
      // Также обновляем source элементы внутри
      const sources = element.querySelectorAll<HTMLSourceElement>("source");
      sources.forEach((source) => {
        const sourceSrc = source.getAttribute("src");
        if (sourceSrc) {
          const sourceR2Key = extractR2Key(sourceSrc);
          if (sourceR2Key === r2Key) {
            source.src = signedUrl;
          }
        }
      });
    } catch (error) {
      console.error(`Error loading signed URL for ${r2Key}:`, error);
    }
  });
  
  // Обрабатываем ссылки на документы (download links)
  const downloadLinks = container.querySelectorAll<HTMLAnchorElement>("a[href^='/media/']");
  
  const linkPromises = Array.from(downloadLinks).map(async (link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    
    const r2Key = extractR2Key(href);
    if (!r2Key) return; // Пропускаем, если это не наш формат
    
    try {
      const response = await fetch(`/api/media-url?key=${encodeURIComponent(r2Key)}`);
      if (!response.ok) {
        console.error(`Failed to get signed URL for ${r2Key}:`, response.statusText);
        return;
      }
      
      const data = (await response.json()) as { url: string };
      const signedUrl = data.url;
      link.href = signedUrl;
      
      // Стилизуем ссылку как кнопку (используем те же классы, что и Button компонент)
      // Добавляем классы только если ссылка еще не стилизована
      if (!link.classList.contains("download-button-styled")) {
        // Сохраняем существующие классы и добавляем стили кнопки
        const existingClasses = link.className.split(" ").filter(c => c && c !== "download-link");
        link.className = [
          "download-link",
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
          "no-underline",
          ...existingClasses
        ].join(" ");
      }
    } catch (error) {
      console.error(`Error loading signed URL for ${r2Key}:`, error);
    }
  });
  
  await Promise.all([...mediaPromises, ...linkPromises]);
}

export function LessonContent({ html, videoAsset, audioAsset }: LessonContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Заменяем URL после монтирования и скрываем дубликаты
    replaceMediaUrls(containerRef.current, videoAsset, audioAsset);
  }, [html, videoAsset, audioAsset]);

  return (
    <div className="max-w-3xl mx-auto" ref={containerRef}>
      <article 
        className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
