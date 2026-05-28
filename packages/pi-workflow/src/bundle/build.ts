import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { loadFromDirectory } from "../dsl/directory-loader.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { WorkflowBundleManifest, WorkflowBundleResourceEntry } from "./types.js";
import type { ResourceDeclaration, ResourceCollectResult } from "../resources/types.js";
import { validateResourcePath, normalizeResourcePath } from "../resources/path-policy.js";
import { readResourceFile, computeResourceMetadata } from "../resources/metadata.js";
import { classifyResource } from "../resources/classify.js";
import { normalizeUsage, collectDslReferencedResources } from "./build-utils.js";
import { buildInlineResourceMap, embedInlineResources } from "./inline-resource.js";
import { createZip } from "./zip-util.js";
import { BundleErrorCodes } from "./errors.js";
import { logger } from "../debug/logger.js";

export interface BuildPwbOptions {
  readonly outFile?: string;
  readonly overwrite?: boolean;
  readonly debug?: boolean;
}

export interface BuildPwbResult {
  readonly manifest: WorkflowBundleManifest;
  readonly pwbData: Buffer;
  readonly diagnostics: readonly WorkflowDiagnostic[];
  readonly pwbPath?: string;
}

export function buildPwbFromDirectory(
  workflowDir: string,
  options?: BuildPwbOptions,
): BuildPwbResult {
  const diagnostics: WorkflowDiagnostic[] = [];

  if (options?.debug) logger.debug({ workflowDir }, "构建 bundle 开始");

  const dirResult = loadFromDirectory(workflowDir);
  diagnostics.push(...dirResult.diagnostics);

  if (options?.debug) {
    logger.debug(
      {
        workflowId: dirResult.document.id,
        resolvedFileCount: dirResult.resolvedFiles.length,
        directoryDiagnosticCount: dirResult.diagnostics.length,
      },
      "目录加载完成",
    );
  }

  if (dirResult.diagnostics.some(d => d.severity === "error")) {
    if (options?.debug) logger.debug({ diagnosticCount: dirResult.diagnostics.length }, "构建失败: 诊断错误");
    return {
      manifest: createEmptyManifest(),
      pwbData: Buffer.alloc(0),
      diagnostics,
    };
  }

  const flowJsonPath = resolve(workflowDir, "flow.json");
  const flowJsonDeclarations = readFlowJsonResources(flowJsonPath, workflowDir);

  const dslDeclarations = collectDslReferencedResources(
    dirResult.document,
    workflowDir,
    dirResult.resolvedFiles,
  );

  const allDeclarations = mergeDeclarations(flowJsonDeclarations, dslDeclarations);

  if (options?.debug) {
    logger.debug(
      {
        flowJsonResourceCount: flowJsonDeclarations.length,
        dslReferencedResourceCount: dslDeclarations.length,
        mergedResourceCount: allDeclarations.length,
      },
      "资源声明收集完成",
    );
  }

  const processedResources = processResources(allDeclarations, workflowDir, diagnostics);

  const acceptedResources = processedResources.filter(
    (r): r is typeof r & { strategy: "inline" | "archive" } => r.strategy !== "reject",
  );
  const rejectResources = processedResources.filter(r => r.strategy === "reject");

  for (const r of rejectResources) {
    diagnostics.push({
      code: r.rejectReason?.startsWith("资源超") ? BundleErrorCodes.RESOURCE_EXCEEDS_LIMIT
        : r.rejectReason?.startsWith("资源文件") ? BundleErrorCodes.FILE_NOT_FOUND
        : r.rejectReason?.startsWith("资源被显式") ? BundleErrorCodes.RESOURCE_UNCLAIMED
        : BundleErrorCodes.RESOURCE_PATH_INVALID,
      severity: "error",
      message: r.rejectReason ?? `资源被拒绝: ${r.path}`,
      path: r.sourcePath || r.path,
    });
  }

  if (rejectResources.length > 0) {
    return {
      manifest: createEmptyManifest(),
      pwbData: Buffer.alloc(0),
      diagnostics,
    };
  }

  const inlineResources = acceptedResources.filter(r => r.strategy === "inline");
  const archiveResources = acceptedResources.filter(r => r.strategy === "archive");

  if (options?.debug) {
    logger.debug(
      {
        acceptedResourceCount: acceptedResources.length,
        inlineResourceCount: inlineResources.length,
        archiveResourceCount: archiveResources.length,
        rejectedResourceCount: rejectResources.length,
      },
      "资源分类完成",
    );
  }

  const inlineMap = buildInlineResourceMap(inlineResources);
  const docWithInlines = embedInlineResources(dirResult.document as unknown as Record<string, unknown>, inlineMap);

  const documentJson = JSON.stringify(docWithInlines, null, 2);
  const documentBuf = Buffer.from(documentJson, "utf-8");
  const documentSha256 = createHash("sha256").update(documentBuf).digest("hex");

  const resourceEntries: WorkflowBundleResourceEntry[] = acceptedResources.map(r => ({
    path: r.path,
    sourcePath: r.sourcePath,
    strategy: r.strategy,
    mediaType: r.mediaType,
    encoding: r.encoding,
    size: r.size,
    sha256: r.sha256,
    usage: r.usage,
  }));

  const manifest: WorkflowBundleManifest = {
    kind: "pi-workflow-bundle",
    bundleVersion: "1",
    workflow: {
      id: dirResult.document.id,
      title: dirResult.document.title,
      version: dirResult.document.version,
    },
    source: {
      type: "directory",
      entry: "flow.json",
      builtAt: new Date().toISOString(),
    },
    document: {
      path: "document.json",
      sha256: documentSha256,
      size: documentBuf.length,
    },
    resources: resourceEntries,
    configSnapshot: { included: false },
    signature: undefined,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const zipFiles = new Map<string, Buffer>();
  zipFiles.set("manifest.json", Buffer.from(manifestJson, "utf-8"));
  zipFiles.set("document.json", documentBuf);

  for (const r of archiveResources) {
    const resourceData = readResourceFile(r.sourcePath).buffer;
    zipFiles.set(`resources/${r.path}`, resourceData);
  }

  if (options?.debug) {
    logger.debug(
      {
        manifestSize: Buffer.byteLength(manifestJson, "utf-8"),
        documentSize: documentBuf.length,
        zipEntryCount: zipFiles.size,
      },
      "bundle 内容装配完成",
    );
  }

  const pwbData = createZip(zipFiles);

  let pwbPath: string | undefined;
  if (options?.outFile) {
    const targetPath = resolve(process.cwd(), options.outFile);
    if (existsSync(targetPath) && !options.overwrite) {
      diagnostics.push({
        code: "BUNDLE-014",
        severity: "error",
        message: `输出文件已存在: ${targetPath} (使用 --overwrite 覆盖)`,
      });
      return { manifest, pwbData: Buffer.alloc(0), diagnostics };
    }
    writeFileSync(targetPath, pwbData);
    pwbPath = targetPath;
  }

  if (options?.debug) {
    logger.debug({ resourceCount: acceptedResources.length, pwbSize: pwbData.length, pwbPath }, "构建完成");
  }

  return { manifest, pwbData, diagnostics, pwbPath };
}

function readFlowJsonResources(
  flowJsonPath: string,
  _workflowDir: string,
): ResourceDeclaration[] {
  if (!existsSync(flowJsonPath)) return [];

  const raw = JSON.parse(readFileSync(flowJsonPath, "utf-8")) as Record<string, unknown>;
  const rawResources = raw["resources"];
  if (!rawResources) return [];
  if (!Array.isArray(rawResources)) return [];

  return rawResources.map((r) => {
    const entry = r as Record<string, unknown>;
    const usage = entry["usage"];
    return {
      path: String(entry["path"] ?? ""),
      usage: typeof usage === "string" ? usage : Array.isArray(usage) ? (usage as string[]) : [],
      strategy: entry["strategy"] as "inline" | "archive" | "reject" | undefined,
    };
  });
}

function mergeDeclarations(
  flowJson: ResourceDeclaration[],
  dslRefs: ResourceDeclaration[],
): ResourceDeclaration[] {
  const seen = new Set<string>();
  const merged: ResourceDeclaration[] = [];

  for (const d of flowJson) {
    const key = normalizeResourcePath(d.path);
    seen.add(key);
    merged.push(d);
  }

  for (const d of dslRefs) {
    const key = normalizeResourcePath(d.path);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(d);
    }
  }

  return merged;
}

function processResources(
  declarations: ResourceDeclaration[],
  workflowDir: string,
  diagnostics: WorkflowDiagnostic[],
): ResourceCollectResult[] {
  const results: ResourceCollectResult[] = [];
  const seenPaths = new Set<string>();

  for (const decl of declarations) {
    const normalized = normalizeResourcePath(decl.path);

    if (seenPaths.has(normalized)) {
      diagnostics.push({
        code: BundleErrorCodes.DUPLICATE_RESOURCE_PATH,
        severity: "warning",
        message: `重复的资源路径: ${normalized}`,
        path: normalized,
      });
      continue;
    }
    seenPaths.add(normalized);

    const validation = validateResourcePath(decl.path, workflowDir);
    if (!validation.valid) {
      results.push({
        path: normalized,
        sourcePath: "",
        strategy: "reject",
        size: 0,
        sha256: "",
        usage: normalizeUsage(decl.usage),
        rejectReason: validation.reason,
      });
      continue;
    }

    const sourcePath = validation.normalizedPath!;
    if (!existsSync(sourcePath)) {
      results.push({
        path: normalized,
        sourcePath,
        strategy: "reject",
        size: 0,
        sha256: "",
        usage: normalizeUsage(decl.usage),
        rejectReason: `资源文件不存在: ${decl.path}`,
      });
      continue;
    }

    const { buffer } = readResourceFile(sourcePath);
    const metadata = computeResourceMetadata(sourcePath, buffer);
    const classification = classifyResource(metadata, decl.strategy);

    if (classification.strategy === "reject") {
      results.push({
        path: normalized,
        sourcePath,
        strategy: "reject",
        size: metadata.size,
        sha256: metadata.sha256,
        usage: normalizeUsage(decl.usage),
        rejectReason: classification.reason ?? "资源超出限制",
      });
      continue;
    }

    results.push({
      path: normalized,
      sourcePath,
      strategy: classification.strategy,
      mediaType: metadata.mediaType,
      encoding: metadata.encoding,
      size: metadata.size,
      sha256: metadata.sha256,
      usage: normalizeUsage(decl.usage),
    });
  }

  return results;
}

export function buildPwbFromDocument(
  doc: Record<string, unknown>,
  debug?: boolean,
): BuildPwbResult {
  if (debug) logger.debug({ docId: doc["id"] }, "从 document 构建 bundle");
  const diagnostics: WorkflowDiagnostic[] = [];

  const docJson = JSON.stringify(doc, null, 2);
  const docBuf = Buffer.from(docJson, "utf-8");
  const docSha256 = createHash("sha256").update(docBuf).digest("hex");

  const manifest: WorkflowBundleManifest = {
    kind: "pi-workflow-bundle",
    bundleVersion: "1",
    workflow: {
      id: (doc["id"] as string) ?? "unknown",
      title: doc["title"] as string | undefined,
      version: doc["version"] as string | undefined,
    },
    source: {
      type: "directory",
      entry: "flow.json",
      builtAt: new Date().toISOString(),
    },
    document: {
      path: "document.json",
      sha256: docSha256,
      size: docBuf.length,
    },
    resources: [],
    configSnapshot: { included: false },
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const zipFiles = new Map<string, Buffer>();
  zipFiles.set("manifest.json", Buffer.from(manifestJson, "utf-8"));
  zipFiles.set("document.json", docBuf);

  const pwbData = createZip(zipFiles);
  if (debug) {
    logger.debug(
      {
        docId: manifest.workflow.id,
        documentSize: docBuf.length,
        manifestSize: Buffer.byteLength(manifestJson, "utf-8"),
        zipEntryCount: zipFiles.size,
        pwbSize: pwbData.length,
      },
      "document bundle 构建完成",
    );
  }
  return { manifest, pwbData, diagnostics };
}

function createEmptyManifest(): WorkflowBundleManifest {
  return {
    kind: "pi-workflow-bundle",
    bundleVersion: "1",
    workflow: { id: "" },
    source: { type: "directory", entry: "flow.json", builtAt: "" },
    document: { path: "document.json", sha256: "", size: 0 },
    resources: [],
    configSnapshot: { included: false },
  };
}
