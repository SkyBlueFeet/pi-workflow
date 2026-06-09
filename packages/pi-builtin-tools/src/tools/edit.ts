import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { applyFileMutations, type FileEdit } from "./file-mutation-queue.js";

export interface EditParams {
  path: string;
  edits: FileEdit[];
}

export interface EditResult {
  content: string;
  isError: boolean;
  details?: {
    patch?: string;
    firstChangedLine?: number;
    editCount: number;
  };
}

export async function editFileTool(params: EditParams): Promise<EditResult> {
  const filePath = resolve(process.cwd(), params.path);

  if (!existsSync(filePath)) {
    return { content: `文件不存在: ${params.path}`, isError: true };
  }

  if (!params.edits || params.edits.length === 0) {
    return { content: "未提供编辑项", isError: true };
  }

  const result = await applyFileMutations({
    filePath,
    edits: params.edits,
  });

  if (!result.success) {
    return { content: `编辑失败: ${result.error}`, isError: true };
  }

  return {
    content: `已编辑 ${filePath} (${params.edits.length} 处变更)`,
    isError: false,
    details: {
      patch: result.patch,
      firstChangedLine: result.firstChangedLine,
      editCount: params.edits.length,
    },
  };
}
