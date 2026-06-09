import { readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";

export interface FindParams {
  pattern: string;
  path: string;
  maxDepth?: number;
  maxResults?: number;
}

export interface FindEntry {
  path: string;
  type: "file" | "directory";
}

export interface FindResult {
  content: string;
  isError: boolean;
  details?: {
    entries: FindEntry[];
    total: number;
    truncated: boolean;
  };
}

function matchesGlobPattern(name: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`, "i").test(name);
}

function walkDir(
  dirPath: string,
  pattern: string,
  currentDepth: number,
  maxDepth: number,
  results: FindEntry[],
  maxResults: number,
): void {
  if (results.length >= maxResults) return;
  if (currentDepth > maxDepth) return;

  let names: string[];
  try {
    names = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const name of names) {
    if (results.length >= maxResults) break;
    if (name.startsWith(".")) continue;
    if (name === "node_modules") continue;

    const fullPath = join(dirPath, name);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    const entryType = stat.isDirectory() ? "directory" : "file";
    if (matchesGlobPattern(name, pattern)) {
      results.push({ path: relative(process.cwd(), fullPath), type: entryType });
    }

    if (stat.isDirectory() && currentDepth < maxDepth) {
      walkDir(fullPath, pattern, currentDepth + 1, maxDepth, results, maxResults);
    }
  }
}

export async function findTool(params: FindParams): Promise<FindResult> {
  const rootPath = resolve(process.cwd(), params.path);
  const maxDepth = params.maxDepth ?? 4;
  const maxResults = params.maxResults ?? 100;

  if (!existsSync(rootPath)) {
    return { content: `路径不存在: ${params.path}`, isError: true };
  }

  const entries: FindEntry[] = [];
  walkDir(rootPath, params.pattern, 0, maxDepth, entries, maxResults);

  const truncated = entries.length >= maxResults;
  const lines = entries.map(e => {
    const icon = e.type === "directory" ? "📁" : "📄";
    return `${icon} ${e.path}`;
  });

  return {
    content: lines.join("\n") || "无匹配文件",
    isError: false,
    details: { entries, total: entries.length, truncated },
  };
}
