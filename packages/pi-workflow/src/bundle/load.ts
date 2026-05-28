import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadFromObject } from "../dsl/loader.js";
import type { WorkflowDslDocument } from "../dsl/types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { WorkflowBundleManifest, WorkflowBundleResourceEntry, WorkflowBundleResourceReader } from "./types.js";
import { BundleResourceReader } from "./resource-reader.js";
import { readZip } from "./zip-util.js";
import { validateManifest, validateBundleHash, validateBundleSize } from "./validator.js";
import { extractInlineResources } from "./inline-resource.js";
import { BundleErrorCodes } from "./errors.js";

export interface PwbLoadResult {
  readonly manifest: WorkflowBundleManifest;
  readonly document: WorkflowDslDocument;
  readonly resourceReader: WorkflowBundleResourceReader;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

export function loadPwbFile(pwbPath: string): PwbLoadResult {
  const diagnostics: WorkflowDiagnostic[] = [];

  if (!existsSync(pwbPath)) {
    diagnostics.push({
      code: BundleErrorCodes.FILE_NOT_FOUND,
      severity: "error",
      message: `bundle 文件不存在: ${pwbPath}`,
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const pwbData = readFileSync(pwbPath);

  let zipEntries: Map<string, Buffer>;
  try {
    zipEntries = readZip(pwbData);
  } catch (err) {
    diagnostics.push({
      code: "BUNDLE-015",
      severity: "error",
      message: `无法读取 bundle 文件: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  if (!zipEntries.has("manifest.json")) {
    diagnostics.push({
      code: BundleErrorCodes.MANIFEST_MISSING,
      severity: "error",
      message: "bundle 中缺少 manifest.json",
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  let manifest: WorkflowBundleManifest;
  try {
    const manifestRaw = JSON.parse(zipEntries.get("manifest.json")!.toString("utf-8"));
    const validation = validateManifest(manifestRaw);
    diagnostics.push(...validation.diagnostics);
    if (!validation.valid) {
      return {
        manifest: null as unknown as WorkflowBundleManifest,
        document: null as unknown as WorkflowDslDocument,
        resourceReader: null as unknown as WorkflowBundleResourceReader,
        diagnostics,
      };
    }
    manifest = manifestRaw as WorkflowBundleManifest;
  } catch (err) {
    diagnostics.push({
      code: BundleErrorCodes.MANIFEST_MISSING,
      severity: "error",
      message: `manifest.json 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  if (!zipEntries.has("document.json")) {
    diagnostics.push({
      code: BundleErrorCodes.DOCUMENT_MISSING,
      severity: "error",
      message: "bundle 中缺少 document.json",
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const documentData = zipEntries.get("document.json")!;
  if (!validateBundleHash(documentData, manifest.document.sha256)) {
    diagnostics.push({
      code: BundleErrorCodes.DOCUMENT_HASH_MISMATCH,
      severity: "error",
      message: "document.json 哈希值不匹配",
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const docRaw = JSON.parse(documentData.toString("utf-8")) as Record<string, unknown>;

  if (!validateBundleSize(documentData, manifest.document.size)) {
    diagnostics.push({
      code: BundleErrorCodes.DOCUMENT_HASH_MISMATCH,
      severity: "error",
      message: "document.json 大小不匹配",
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const { document: docWithoutInlines, inlineMap } = extractInlineResources(docRaw);

  let document: WorkflowDslDocument;
  try {
    const dslResult = loadFromObject(docWithoutInlines);
    diagnostics.push(...dslResult.diagnostics.filter(d => d.severity === "error" ? true : false));
    document = dslResult.document;
  } catch (err) {
    diagnostics.push({
      code: "BUNDLE-016",
      severity: "error",
      message: `document.json 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      manifest: null as unknown as WorkflowBundleManifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  if (diagnostics.some(d => d.severity === "error")) {
    return {
      manifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const resourceEntries = new Map<string, { data: Buffer; meta: WorkflowBundleResourceEntry }>();
  for (const entry of manifest.resources) {
    if (entry.strategy === "inline") {
      const inlineContent = inlineMap[entry.path];
      if (inlineContent !== undefined) {
        const data = Buffer.from(inlineContent, "utf-8");
        if (!validateBundleSize(data, entry.size)) {
          diagnostics.push({
            code: BundleErrorCodes.RESOURCE_HASH_MISMATCH,
            severity: "error",
            message: `资源 ${entry.path} 大小不匹配`,
            path: entry.path,
          });
          continue;
        }
        const actualHash = createHash("sha256").update(data).digest("hex");
        if (actualHash !== entry.sha256) {
          diagnostics.push({
            code: BundleErrorCodes.RESOURCE_HASH_MISMATCH,
            severity: "error",
            message: `资源 ${entry.path} 哈希值不匹配`,
            path: entry.path,
          });
          continue;
        }
        resourceEntries.set(entry.path, { data, meta: entry });
        continue;
      }
    }

    const zipPath = `resources/${entry.path}`;
    const data = zipEntries.get(zipPath);

    if (!data) {
      diagnostics.push({
        code: BundleErrorCodes.RESOURCE_HASH_MISMATCH,
        severity: "error",
        message: `bundle 中缺少资源: ${entry.path}`,
        path: entry.path,
      });
      continue;
    }

    if (!validateBundleSize(data, entry.size)) {
      diagnostics.push({
        code: BundleErrorCodes.RESOURCE_HASH_MISMATCH,
        severity: "error",
        message: `资源 ${entry.path} 大小不匹配`,
        path: entry.path,
      });
      continue;
    }

    const actualHash = createHash("sha256").update(data).digest("hex");
    if (actualHash !== entry.sha256) {
      diagnostics.push({
        code: BundleErrorCodes.RESOURCE_HASH_MISMATCH,
        severity: "error",
        message: `资源 ${entry.path} 哈希值不匹配`,
        path: entry.path,
      });
      continue;
    }

    resourceEntries.set(entry.path, { data, meta: entry });
  }

  if (diagnostics.some(d => d.severity === "error")) {
    return {
      manifest,
      document: null as unknown as WorkflowDslDocument,
      resourceReader: null as unknown as WorkflowBundleResourceReader,
      diagnostics,
    };
  }

  const resourceReader = new BundleResourceReader(resourceEntries);

  return { manifest, document, resourceReader, diagnostics };
}
