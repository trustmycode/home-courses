import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const repoRoot = process.cwd();

export async function renderMarkdownFromRepoPath(repoRelativePath: string): Promise<string> {
  // repoRelativePath вроде "content/demo-course/lessons/01-intro.mdx"
  const fullPath = path.join(repoRoot, "..", "..", "..", "..", repoRelativePath);
  const raw = await fs.readFile(fullPath, "utf-8");
  return marked.parse(raw);
}

