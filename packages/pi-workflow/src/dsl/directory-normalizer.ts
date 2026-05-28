import { basename } from "node:path";
import type {
  WorkflowDslControlConfig,
  WorkflowDslDefaults,
  WorkflowDslExecutorConfig,
  WorkflowDslMissingInput,
  WorkflowDslResources,
  WorkflowDslSettings,
} from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { mergeDefaults, mergeExecutor, mergeControl, mergeResources, mergeSettings, stripUndefined } from "./directory-merge.js";

/** 目录加载时逐层传递的继承上下文，用于 defaults/resources/settings 合并。 */
export interface DirectoryInheritanceContext {
  readonly version?: string;
  readonly defaults?: WorkflowDslDefaults;
  readonly resources?: WorkflowDslResources;
  readonly settings?: WorkflowDslSettings;
}

/**
 * 基于父级上下文与当前目录 flow 源数据，生成当前目录可见的继承上下文。
 */
export function buildDirectoryInheritanceContext(
  source: Readonly<Record<string, unknown>>,
  parent?: DirectoryInheritanceContext,
): DirectoryInheritanceContext {
  return {
    version: asString(source["version"]) ?? parent?.version ?? "1.0",
    defaults: mergeDefaults(parent?.defaults, asDefaults(source["defaults"])),
    resources: mergeResources(parent?.resources, asResources(source["resources"])),
    settings: mergeSettings(parent?.settings, asSettings(source["settings"])),
  };
}

/**
 * 将目录式宽松源文档补全为当前严格 DSL 形态，再交给既有 loader 校验。
 */
export function normalizeDirectoryDocument(
  source: Readonly<Record<string, unknown>>,
  workflowDir: string,
  diagnostics: WorkflowDiagnostic[],
  inherited: DirectoryInheritanceContext,
): Record<string, unknown> {
  const nodes = normalizeNodes(source["nodes"], inherited);
  const id = asString(source["id"]) ?? basename(workflowDir);
  const entry = resolveEntry(source, nodes, diagnostics);

  return {
    id,
    version: inherited.version ?? "1.0",
    title: asString(source["title"]) ?? id,
    entry,
    nodes,
    defaults: inherited.defaults,
    resources: inherited.resources,
    settings: inherited.settings,
  };
}

function normalizeNodes(
  value: unknown,
  inherited: DirectoryInheritanceContext,
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(node => normalizeNode(asRecord(node) ?? {}, inherited));
}

function normalizeNode(
  node: Readonly<Record<string, unknown>>,
  inherited: DirectoryInheritanceContext,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    id: asString(node["id"]) ?? "",
    title: asString(node["title"]) ?? asString(node["id"]) ?? "",
    inputs: node["inputs"],
    output: node["output"],
    dependsOn: node["dependsOn"],
    children: node["children"],
    subWorkflowDir: node["subWorkflowDir"],
    capabilities: node["capabilities"],
  };

  const executor = mergeExecutor(inherited.defaults?.executor, asExecutor(node["executor"]));
  if (executor) {
    normalized["executor"] = executor;
  }

  const control = mergeControl(inherited.defaults?.control, asControl(node["control"]));
  if (control) {
    normalized["control"] = control;
  }

  const missingInput = asMissingInput(node["missingInput"]) ?? inherited.defaults?.missingInput;
  if (missingInput) {
    normalized["missingInput"] = missingInput;
  }

  return stripUndefined(normalized);
}

function resolveEntry(
  source: Readonly<Record<string, unknown>>,
  nodes: readonly Record<string, unknown>[],
  diagnostics: WorkflowDiagnostic[],
): string {
  const explicitEntry = asString(source["entry"]);
  if (explicitEntry) return explicitEntry;

  const nodeIds = new Set(nodes.map(node => asString(node["id"]) ?? "").filter(Boolean));
  const incoming = new Set<string>();

  for (const node of nodes) {
    const nodeId = asString(node["id"]);
    if (!nodeId) continue;
    for (const dep of asStringArray(node["dependsOn"])) {
      if (nodeIds.has(dep)) {
        incoming.add(nodeId);
      }
    }
  }

  const rootIds = nodes
    .map(node => asString(node["id"]) ?? "")
    .filter(id => id && !incoming.has(id));

  if (rootIds.length === 1) {
    return rootIds[0];
  }

  if (rootIds.length > 1) {
    diagnostics.push({
      code: "DIR-006",
      severity: "error",
      message: `entry 缺失且存在多个候选入口节点: ${rootIds.join(", ")}`,
    });
    return "";
  }

  if (nodes.length > 0) {
    diagnostics.push({
      code: "DIR-007",
      severity: "error",
      message: "entry 缺失且无法从节点依赖中推导入口",
    });
  }

  return "";
}

function asDefaults(value: unknown): WorkflowDslDefaults | undefined {
  return asRecord(value) as WorkflowDslDefaults | undefined;
}

function asResources(value: unknown): WorkflowDslResources | undefined {
  return asRecord(value) as WorkflowDslResources | undefined;
}

function asSettings(value: unknown): WorkflowDslSettings | undefined {
  return asRecord(value) as WorkflowDslSettings | undefined;
}

function asExecutor(value: unknown): WorkflowDslExecutorConfig | undefined {
  return asRecord(value) as WorkflowDslExecutorConfig | undefined;
}

function asControl(value: unknown): WorkflowDslControlConfig | undefined {
  return asRecord(value) as WorkflowDslControlConfig | undefined;
}

function asMissingInput(value: unknown): WorkflowDslMissingInput | undefined {
  return asRecord(value) as WorkflowDslMissingInput | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}


