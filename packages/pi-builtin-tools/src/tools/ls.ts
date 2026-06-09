import { readdirSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface LsParams {
  path: string;
}

export interface DirEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
}

export interface LsResult {
  content: string;
  isError: boolean;
  details?: {
    entries: DirEntry[];
    total: number;
  };
}

export async function lsTool(params: LsParams): Promise<LsResult> {
  const dirPath = resolve(process.cwd(), params.path);

  if (!existsSync(dirPath)) {
    return { content: `目录不存在: ${params.path}`, isError: true };
  }

  const stat = statSync(dirPath);
  if (!stat.isDirectory()) {
    return { content: `路径不是目录: ${params.path}`, isError: true };
  }

  const names = readdirSync(dirPath);
  const entries: DirEntry[] = names.map(name => {
    const fullPath = `${dirPath}/${name}`;
    let isDir = false;
    let size: number | undefined;
    try {
      const s = statSync(fullPath);
      isDir = s.isDirectory();
      if (!isDir) size = s.size;
    } catch { /* ignore */ }
    return { name, type: isDir ? "directory" : "file", size };
  });

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const lines = entries.map(e => {
    const icon = e.type === "directory" ? "📁" : "📄";
    const sizeStr = e.size !== undefined ? ` (${e.size} bytes)` : "";
    return `${icon} ${e.name}${sizeStr}`;
  });

  return {
    content: lines.join("\n"),
    isError: false,
    details: { entries, total: entries.length },
  };
}
