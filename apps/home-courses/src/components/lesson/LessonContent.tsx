"use client";

import { useEffect, useRef } from "react";

interface LessonContentProps {
  html: string;
}

/**
 * Извлекает r2Key из URL формата /media/{r2Key}
 */
function extractR2Key(src: string): string | null {
  const match = src.match(/^\/media\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Заменяет src атрибуты video/audio тегов на подписанные URL
 */
async function replaceMediaUrls(container: HTMLElement) {
  const mediaElements = container.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio");
  
  const promises = Array.from(mediaElements).map(async (element) => {
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
  
  await Promise.all(promises);
}

export function LessonContent({ html }: LessonContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Заменяем URL после монтирования
    replaceMediaUrls(containerRef.current);
  }, [html]);

  return (
    <div className="max-w-3xl mx-auto" ref={containerRef}>
      <article 
        className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
