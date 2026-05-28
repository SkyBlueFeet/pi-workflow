import type { WorkflowDiagnostic } from "../../ir/diagnostics.js";
import type { WorkflowNodeKind } from "../../ir/types.js";
import type { WorkflowDslDocument } from "../../dsl/types.js";
import { WorkflowDefineDiagnosticCodes } from "./types.js";
import { importSteps, applyNextEdges, resolveEntry } from "./importer-steps.js";

const SupportedKinds = new Set<WorkflowNodeKind>([
  "manual",
  "workflow",
  "return",
  "agent",
  "tool",
  "http",
  "if",
  "parallel",
  "loop",
]);

const StepFields = new Set([
  "id",
  "type",
  "title",
  "dependsOn",
  "inputs",
  "output",
  "children",
  "next",
  "subWorkflow",
]);

export function importDocument(
  input: Record<string, unknown>,
  diagnostics: WorkflowDiagnostic[],
  prefix = "",
): WorkflowDslDocument {
  const steps = readSteps(input["steps"], diagnostics, prefix);
  const importedNodes = importSteps(steps, diagnostics, prefix);
  const nodes = applyNextEdges(importedNodes.nodes, importedNodes.nextEdges, diagnostics);
  const requestedEntry = prefixValue(firstString(input["startAt"], input["entry"]), prefix);
  const entry = resolveEntry(nodes, requestedEntry, diagnostics, prefix);
  const docId = prefix ? `${prefix.slice(0, -1)}-subflow` : firstString(input["id"], input["name"]) ?? "workflow-define";

  if (steps.length === 0) {
    diagnostics.push(createDiagnostic(
      WorkflowDefineDiagnosticCodes.INVALID_DOCUMENT,
      "error",
      `${prefix || "root"} 缺少可导入的 steps`,
    ));
  }

  return {
    id: docId,
    version: asString(input["version"]) ?? "1.0",
    title: asString(input["title"]) ?? docId,
    entry,
    nodes,
  };
}

function pushUnsupportedFieldDiagnostics(
  step: Record<string, unknown>,
  nodeId: string,
  diagnostics: WorkflowDiagnostic[],
): void {
  for (const key of Object.keys(step)) {
    if (StepFields.has(key)) continue;
    diagnostics.push(createDiagnostic(
      WorkflowDefineDiagnosticCodes.UNSUPPORTED_FIELD,
      "warning",
      `step "${nodeId}" 的字段 "${key}" 暂未映射，已忽略`,
      nodeId,
    ));
  }
}

function readSteps(
  value: unknown,
  diagnostics: WorkflowDiagnostic[],
  prefix: string,
): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(item => asRecord(item)).filter((item): item is Record<string, unknown> => item !== undefined);
  }

  const record = asRecord(value);
  if (!record) {
    diagnostics.push(createDiagnostic(
      WorkflowDefineDiagnosticCodes.INVALID_DOCUMENT,
      "error",
      `${prefix || "root"} 的 steps 必须为数组或对象映射`,
    ));
    return [];
  }

  return Object.entries(record).map(([id, step]) => ({ id, ...(asRecord(step) ?? {}) }));
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function prefixValue(value: string | undefined, prefix: string): string | undefined {
  if (!value) return undefined;
  return `${prefix}${value}`;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asMergeStrategy(value: unknown): "replace" | "merge-object" | "append-array" | undefined {
  return value === "replace" || value === "merge-object" || value === "append-array"
    ? value
    : undefined;
}

function createDiagnostic(
  code: string,
  severity: "error" | "warning",
  message: string,
  nodeId?: string,
): WorkflowDiagnostic {
  return { code, severity, message, nodeId };
}

export { SupportedKinds, createDiagnostic, asString, asRecord, asMergeStrategy, pushUnsupportedFieldDiagnostics, readStringArray };
