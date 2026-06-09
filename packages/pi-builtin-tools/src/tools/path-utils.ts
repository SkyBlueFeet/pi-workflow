import { resolve, normalize, relative, sep } from "node:path";

export function resolvePath(basePath: string, inputPath: string): string {
  const resolved = resolve(basePath, inputPath);
  return normalize(resolved);
}

export function isSubPath(basePath: string, targetPath: string): boolean {
  const base = normalize(resolve(basePath));
  const target = normalize(resolve(basePath, targetPath));
  const rel = relative(base, target);
  return !rel.startsWith("..") && !sep.startsWith("..");
}

export function getRelativePath(basePath: string, targetPath: string): string {
  return relative(basePath, targetPath);
}
