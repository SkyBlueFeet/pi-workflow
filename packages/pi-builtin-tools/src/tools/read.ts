import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { truncateContent, buildTruncationNotice } from "./truncate.js";
import type { TruncationResult } from "./truncate.js";

export interface ReadParams {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadResult {
  content: string;
  isError: boolean;
  details?: {
    truncation?: TruncationResult;
    notice?: string;
  };
}

export async function readFileTool(params: ReadParams): Promise<ReadResult> {
  const filePath = resolve(process.cwd(), params.path);

  if (!existsSync(filePath)) {
    return { content: `文件不存在: ${params.path}`, isError: true };
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return { content: `路径不是文件: ${params.path}`, isError: true };
  }

  const text = readFileSync(filePath, "utf-8");
  const offset = params.offset ?? 0;
  const limit = params.limit;

  const truncation = truncateContent(text, offset, limit);
  const notice = buildTruncationNotice(truncation, params.path);

  let content = truncation.content;
  if (notice) {
    content += `\n\n${notice}`;
  }

  return {
    content,
    isError: false,
    details: { truncation, notice },
  };
}
