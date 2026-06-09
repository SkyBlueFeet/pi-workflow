import { readFileSync, writeFileSync } from "node:fs";

export interface FileEdit {
  oldText: string;
  newText: string;
}

export interface FileMutation {
  filePath: string;
  edits: FileEdit[];
}

export interface MutationResult {
  success: boolean;
  error?: string;
  patch?: string;
  firstChangedLine?: number;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function generatePatch(filePath: string, edits: FileEdit[]): string {
  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);
  for (const edit of edits) {
    const oldLines = edit.oldText.split("\n");
    const newLines = edit.newText.split("\n");
    lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
    for (const l of oldLines) {
      lines.push(`-${l}`);
    }
    for (const l of newLines) {
      lines.push(`+${l}`);
    }
  }
  return lines.join("\n");
}

function countPrecedingNewlines(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export async function applyFileMutations(mutation: FileMutation): Promise<MutationResult> {
  const { filePath, edits } = mutation;

  try {
    const original = readFileSync(filePath, "utf-8");
    const normalized = normalizeLineEndings(original);
    let current = normalized;
    let firstChangedLine: number | undefined;

    for (const edit of edits) {
      const idx = current.indexOf(edit.oldText);
      if (idx === -1) {
        return {
          success: false,
          error: `未在文件中找到匹配的原文: "${edit.oldText.slice(0, 50)}..."`,
        };
      }

      if (firstChangedLine === undefined) {
        firstChangedLine = countPrecedingNewlines(current, idx);
      }

      current = current.replace(edit.oldText, edit.newText);
    }

    writeFileSync(filePath, current, "utf-8");

    return {
      success: true,
      patch: generatePatch(filePath, edits),
      firstChangedLine,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
