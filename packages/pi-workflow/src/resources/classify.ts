import type { ResourceMetadata } from "./metadata.js";

const INLINE_MAX_SIZE = 64 * 1024;
const ARCHIVE_MAX_SIZE = 10 * 1024 * 1024;

export type ClassifyStrategy = "inline" | "archive" | "reject";

export interface ClassifyResult {
  readonly strategy: ClassifyStrategy;
  readonly reason?: string;
}

export function classifyResource(
  metadata: ResourceMetadata,
  declaredStrategy?: string,
): ClassifyResult {
  if (declaredStrategy === "inline" || declaredStrategy === "archive" || declaredStrategy === "reject") {
    if (declaredStrategy === "reject") {
      return { strategy: "reject", reason: "资源被显式声明为 reject" };
    }
    return { strategy: declaredStrategy };
  }

  if (metadata.size > ARCHIVE_MAX_SIZE) {
    return { strategy: "reject", reason: `资源超过 ${ARCHIVE_MAX_SIZE / 1024 / 1024}MB 上限 (${metadata.size} bytes)` };
  }

  if (metadata.isText && metadata.size <= INLINE_MAX_SIZE) {
    return { strategy: "inline" };
  }

  if (metadata.size > INLINE_MAX_SIZE) {
    return { strategy: "archive", reason: `资源超过 ${INLINE_MAX_SIZE / 1024}KB 内联上限 (${metadata.size} bytes)` };
  }

  return { strategy: "archive" };
}
