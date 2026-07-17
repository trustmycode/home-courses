import { getCloudflareContext } from "@opennextjs/cloudflare";
import sanitizeHtml from "sanitize-html";

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "audio",
  "figure",
  "figcaption",
  "source",
  "video",
];

function cleanLessonHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      "*": ["class", "data-asset-id", "data-asset-type", "data-required"],
      a: ["href", "rel", "target", "title", "download"],
      audio: ["controls", "preload", "src"],
      img: ["alt", "height", "loading", "src", "title", "width"],
      source: ["src", "type"],
      video: ["controls", "height", "playsinline", "poster", "preload", "src", "width"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src", "poster"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs:
          attributes.target === "_blank"
            ? { ...attributes, rel: "noopener noreferrer" }
            : attributes,
      }),
    },
  });
}

export async function loadHtml(contentHtmlKey: string): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.COURSE_MEDIA.get(contentHtmlKey);

  if (!obj) {
    throw new Error(`HTML file not found in R2: ${contentHtmlKey}`);
  }

  return cleanLessonHtml(await obj.text());
}

// Оставляем для обратной совместимости, если нужно
export async function loadMdx(contentKey: string): Promise<string> {
  return loadHtml(contentKey);
}
