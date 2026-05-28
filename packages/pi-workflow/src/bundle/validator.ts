import type { WorkflowBundleResourceEntry } from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { createHash } from "node:crypto";
import { BundleErrorCodes } from "./errors.js";

export interface BundleValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

export function validateManifest(data: unknown): BundleValidationResult {
  const diagnostics: WorkflowDiagnostic[] = [];
  const manifest = data as Record<string, unknown> | null;

  if (!manifest || typeof manifest !== "object") {
    diagnostics.push({
      code: BundleErrorCodes.INVALID_KIND,
      severity: "error",
      message: "manifest 数据不是有效对象",
    });
    return { valid: false, diagnostics };
  }

  if (manifest.kind !== "pi-workflow-bundle") {
    diagnostics.push({
      code: BundleErrorCodes.INVALID_KIND,
      severity: "error",
      message: `非法 kind: ${String(manifest.kind)}，期望 "pi-workflow-bundle"`,
    });
  }

  if (manifest.bundleVersion !== "1") {
    diagnostics.push({
      code: BundleErrorCodes.UNSUPPORTED_VERSION,
      severity: "error",
      message: `不支持的 bundleVersion: ${String(manifest.bundleVersion)}`,
    });
  }

  const doc = manifest.document as Record<string, unknown> | undefined;
  if (!doc || doc.path !== "document.json") {
    diagnostics.push({
      code: BundleErrorCodes.DOCUMENT_MISSING,
      severity: "error",
      message: "manifest 缺少 document.path 或 document.path 不为 document.json",
    });
  }

  const resources = manifest.resources;
  if (resources !== undefined && !Array.isArray(resources)) {
    diagnostics.push({
      code: BundleErrorCodes.RESOURCE_PATH_INVALID,
      severity: "error",
      message: "manifest.resources 不是数组",
    });
  }

  if (resources && Array.isArray(resources)) {
    const seen = new Set<string>();
    for (const r of resources as WorkflowBundleResourceEntry[]) {
      if (!r.path) {
        diagnostics.push({
          code: BundleErrorCodes.RESOURCE_PATH_INVALID,
          severity: "error",
          message: "资源条目缺少 path 字段",
        });
      }
      if (seen.has(r.path)) {
        diagnostics.push({
          code: BundleErrorCodes.DUPLICATE_RESOURCE_PATH,
          severity: "error",
          message: `重复的资源路径: ${r.path}`,
        });
      }
      seen.add(r.path);
    }
  }

  const configSnapshot = manifest.configSnapshot as Record<string, unknown> | undefined;
  if (configSnapshot && configSnapshot.included !== false) {
    diagnostics.push({
      code: "BUNDLE-013",
      severity: "warning",
      message: "configSnapshot.included 应设为 false",
    });
  }

  return {
    valid: diagnostics.filter(d => d.severity === "error").length === 0,
    diagnostics,
  };
}

export function validateBundleHash(
  data: Buffer,
  expectedSha256: string,
): boolean {
  const actual = createHash("sha256").update(data).digest("hex");
  return actual === expectedSha256;
}

export function validateBundleSize(
  data: Buffer,
  expectedSize: number,
): boolean {
  return data.length === expectedSize;
}
