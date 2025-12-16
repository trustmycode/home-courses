import { marked } from "marked";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function loadMdx(contentKey: string): Promise<string> {
  const { env } = getCloudflareContext();
  const obj = await env.COURSE_MEDIA.get(contentKey);

  if (!obj) {
    throw new Error(`MDX file not found in R2: ${contentKey}`);
  }

  const raw = await obj.text();
  return marked.parse(raw);
}

export async function renderMarkdownFromRepoPath(
  repoRelativePath: string
): Promise<string> {
  return loadMdx(repoRelativePath);
}
