import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

async function findRepoRoot(startPath: string): Promise<string> {
  let current = path.resolve(startPath);
  
  while (current !== path.dirname(current)) {
    const contentPath = path.join(current, "content", "courses.json");
    try {
      await fs.access(contentPath);
      return current;
    } catch {
      // Continue searching
    }
    current = path.dirname(current);
  }
  
  throw new Error("Could not find repo root (content/courses.json)");
}

let repoRootCache: string | null = null;

async function getRepoRoot(): Promise<string> {
  if (repoRootCache) return repoRootCache;
  
  const startPath = process.cwd();
  repoRootCache = await findRepoRoot(startPath);
  return repoRootCache;
}

export async function renderMarkdownFromRepoPath(repoRelativePath: string): Promise<string> {
  // repoRelativePath вроде "content/demo-course/lessons/01-intro.mdx"
  const repoRoot = await getRepoRoot();
  const fullPath = path.join(repoRoot, repoRelativePath);
  const raw = await fs.readFile(fullPath, "utf-8");
  return marked.parse(raw);
}