import { statSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";

export interface GrepParams {
  pattern: string;
  path: string;
  recursive?: boolean;
  maxResults?: number;
}

export interface MatchResult {
  file: string;
  line: number;
  content: string;
}

export interface GrepResult {
  content: string;
  isError: boolean;
  details?: {
    matches: MatchResult[];
    total: number;
    truncated: boolean;
  };
}

function collectFiles(dirPath: string, recursive: boolean, results: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const name of names) {
    const fullPath = join(dirPath, name);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (recursive && !name.startsWith(".") && !name.startsWith("node_modules")) {
        collectFiles(fullPath, recursive, results);
      }
    } else if (stat.isFile()) {
      results.push(fullPath);
    }
  }
}

export async function grepTool(params: GrepParams): Promise<GrepResult> {
  const rootPath = resolve(process.cwd(), params.path);
  const maxResults = params.maxResults ?? 50;

  if (!existsSync(rootPath)) {
    return { content: `路径不存在: ${params.path}`, isError: true };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(params.pattern, "g");
  } catch {
    return { content: `无效的正则表达式: ${params.pattern}`, isError: true };
  }

  let files: string[];
  const stat = statSync(rootPath);
  if (stat.isFile()) {
    files = [rootPath];
  } else {
    files = [];
    collectFiles(rootPath, params.recursive ?? false, files);
  }

  const matches: MatchResult[] = [];
  for (const filePath of files) {
    if (matches.length >= maxResults) break;

    try {
      const text = readFileSync(filePath, "utf-8");
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const relPath = relative(process.cwd(), filePath);
          matches.push({ file: relPath, line: i + 1, content: lines[i].trim() });
          if (matches.length >= maxResults) break;
        }
        regex.lastIndex = 0;
      }
    } catch {
      continue;
    }
  }

  const truncated = matches.length >= maxResults;
  const lines = matches.map(m => `${m.file}:${m.line}:${m.content}`);

  return {
    content: lines.join("\n") || "无匹配结果",
    isError: false,
    details: { matches, total: matches.length, truncated },
  };
}
