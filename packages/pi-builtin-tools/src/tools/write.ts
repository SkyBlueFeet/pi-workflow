import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface WriteParams {
  path: string;
  content: string;
}

export interface WriteResult {
  content: string;
  isError: boolean;
  details?: {
    filePath: string;
    bytesWritten: number;
  };
}

export async function writeFileTool(params: WriteParams): Promise<WriteResult> {
  const filePath = resolve(process.cwd(), params.path);
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, params.content, "utf-8");

  return {
    content: `已写入 ${filePath} (${params.content.length} 字符)`,
    isError: false,
    details: {
      filePath,
      bytesWritten: params.content.length,
    },
  };
}
