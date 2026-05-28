import { readFileSync, existsSync } from "node:fs";
import type { WorkflowDslDocument } from "../dsl/types.js";
import type { ResourceCollectResult, ResourceDeclaration } from "./types.js";
import { validateResourcePath, normalizeResourcePath } from "./path-policy.js";
import { readResourceFile, computeResourceMetadata } from "./metadata.js";
import { classifyResource } from "./classify.js";

export function collectResourcesFromFlowJson(
  flowJsonPath: string,
): ResourceDeclaration[] {
  const raw = JSON.parse(
    readFileSync(flowJsonPath, "utf-8"),
  ) as Record<string, unknown>;

  const rawResources = raw["resources"];
  if (!rawResources) return [];

  if (Array.isArray(rawResources)) {
    return rawResources.map(r => {
      const entry = r as Record<string, unknown>;
      return {
        path: entry["path"] as string,
        usage: entry["usage"] as string | readonly string[] ?? [],
        strategy: entry["strategy"] as "inline" | "archive" | "reject" | undefined,
      };
    });
  }

  return [];
}

export function collectDslReferencedResources(
  doc: WorkflowDslDocument,
): ResourceDeclaration[] {
  const declarations: ResourceDeclaration[] = [];
  const seen = new Set<string>();

  for (const node of doc.nodes) {
    const promptFile = node.executor?.promptFile;
    if (promptFile && !seen.has(promptFile)) {
      seen.add(promptFile);
      declarations.push({
        path: promptFile,
        usage: `node:${node.id}:prompt_file`,
        strategy: "inline",
      });
    }
  }

  return declarations;
}

export function processResourceDeclarations(
  declarations: ResourceDeclaration[],
  workflowDir: string,
): ResourceCollectResult[] {
  const results: ResourceCollectResult[] = [];
  const seenPaths = new Set<string>();

  for (const decl of declarations) {
    const normalized = normalizeResourcePath(decl.path);

    if (seenPaths.has(normalized)) continue;
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
        rejectReason: classification.reason,
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

function normalizeUsage(usage: string | readonly string[]): readonly string[] {
  if (typeof usage === "string") return usage ? [usage] : [];
  return usage ?? [];
}
