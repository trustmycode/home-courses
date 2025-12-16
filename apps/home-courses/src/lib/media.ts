import { MEDIA_PATH_PREFIX } from "./constants";

export function mediaUrl(r2Key: string) {
    return `${MEDIA_PATH_PREFIX}/${r2Key}`;
}

export function processMediaUrlsInHtml(html: string): string {
    // Относительные пути уже правильные, просто возвращаем HTML как есть
    // (или можно оставить для обратной совместимости, если нужно)
    return html;
}
  