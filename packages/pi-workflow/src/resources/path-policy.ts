import { resolve, isAbsolute, normalize } from "node:path";

export interface PathValidationResult {
  readonly valid: boolean;
  readonly normalizedPath?: string;
  readonly reason?: string;
}

export function validateResourcePath(
  refPath: string,
  workflowDir: string,
): PathValidationResult {
  if (isAbsolute(refPath)) {
    return { valid: false, reason: `绝对路径不允许: ${refPath}` };
  }

  const normalized = normalize(refPath);
  if (normalized.startsWith("..")) {
    return { valid: false, reason: `路径逃逸不允许: ${refPath}` };
  }
  if (normalized.includes("..\\") || normalized.includes("../")) {
    return { valid: false, reason: `路径包含上层引用: ${refPath}` };
  }

  const absolute = resolve(workflowDir, normalized);
  const workflowRoot = resolve(workflowDir);
  if (!absolute.startsWith(workflowRoot)) {
    return { valid: false, reason: `路径逃逸出工作流根目录: ${refPath}` };
  }

  return { valid: true, normalizedPath: absolute };
}

export function normalizeResourcePath(refPath: string): string {
  const normalized = normalize(refPath).replace(/\\/g, "/");
  if (normalized.startsWith("./")) return normalized.slice(2);
  return normalized;
}
