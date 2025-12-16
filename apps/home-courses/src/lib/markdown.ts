import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function loadHtml(contentHtmlKey: string): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.COURSE_MEDIA.get(contentHtmlKey);

  if (!obj) {
    throw new Error(`HTML file not found in R2: ${contentHtmlKey}`);
  }

  // Возвращаем готовый HTML, без парсинга
  return await obj.text();
}

// Оставляем для обратной совместимости, если нужно
export async function loadMdx(contentKey: string): Promise<string> {
  return loadHtml(contentKey);
}
