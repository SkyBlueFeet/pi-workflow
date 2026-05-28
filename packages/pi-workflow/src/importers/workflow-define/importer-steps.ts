import type { WorkflowDiagnostic } from "../../ir/diagnostics.js";
import type { WorkflowNodeKind } from "../../ir/types.js";
import type { WorkflowDslNode, WorkflowDslDocument } from "../../dsl/types.js";
import { WorkflowDefineDiagnosticCodes } from "./types.js";
import {
  createDiagnostic,
  asString,
  asRecord,
  pushUnsupportedFieldDiagnostics,
  readStringArray,
  importDocument,
  SupportedKinds,
} from "./importer-helpers.js";
import { mapInputs, mapOutput } from "./importer-mapping.js";

function importSteps(
  steps: readonly Record<string, unknown>[],
  diagnostics: WorkflowDiagnostic[],
  prefix: string,
): { readonly nodes: readonly WorkflowDslNode[]; readonly nextEdges: readonly [string, string][] } {
  const nodes: WorkflowDslNode[] = [];
  const nextEdges: Array<[string, string]> = [];

  for (const step of steps) {
    const rawId = asString(step["id"]);
    if (!rawId) {
      diagnostics.push(createDiagnostic(
        WorkflowDefineDiagnosticCodes.MISSING_STEP_ID,
        "error",
        `${prefix || "root"} 存在缺少 id 的 step`,
      ));
      continue;
    }

    const id = `${prefix}${rawId}`;
    const kind = asString(step["type"]);
    if (!kind || !SupportedKinds.has(kind as WorkflowNodeKind)) {
      diagnostics.push(createDiagnostic(
        WorkflowDefineDiagnosticCodes.UNSUPPORTED_STEP_TYPE,
        "warning",
        `step "${id}" 的 type "${kind ?? "unknown"}" 当前无法映射，已跳过`,
        id,
      ));
      continue;
    }

    pushUnsupportedFieldDiagnostics(step, id, diagnostics);

    const dependsOn = readStringArray(step["dependsOn"]).map(dep => `${prefix}${dep}`);
    const children = readStringArray(step["children"]).map(child => `${prefix}${child}`);
    const node: WorkflowDslNode = {
      id,
      title: asString(step["title"]) ?? rawId,
      dependsOn,
      inputs: mapInputs(step["inputs"]),
      output: mapOutput(step["output"]),
      children,
      executor: { type: kind as WorkflowNodeKind },
    };

    const next = readStringArray(step["next"]).map(target => [`${id}`, `${prefix}${target}`] as [string, string]);
    nextEdges.push(...next);

    const subWorkflow = asRecord(step["subWorkflow"]);
    if (kind === "workflow" && subWorkflow) {
      const imported = importDocument(subWorkflow, diagnostics, `${id}.`);
      const nestedEntryIds = collectEntryIds(imported);
      const nestedNodes = imported.nodes.map(nestedNode => {
        if (!nestedEntryIds.includes(nestedNode.id)) return nestedNode;
        return {
          ...nestedNode,
          dependsOn: [...new Set([...(nestedNode.dependsOn ?? []), ...dependsOn])],
        };
      });

      nodes.push({ ...node, children: nestedEntryIds });
      nodes.push(...nestedNodes);
      continue;
    }

    nodes.push(node);
  }

  return { nodes, nextEdges };
}

function applyNextEdges(
  nodes: readonly WorkflowDslNode[],
  nextEdges: readonly [string, string][],
  diagnostics: WorkflowDiagnostic[],
): readonly WorkflowDslNode[] {
  const byId = new Map(nodes.map(node => [node.id, node]));

  for (const [from, to] of nextEdges) {
    const target = byId.get(to);
    if (!target) {
      diagnostics.push(createDiagnostic(
        WorkflowDefineDiagnosticCodes.INVALID_REFERENCE,
        "warning",
        `next 引用的目标 step "${to}" 不存在`,
        from,
      ));
      continue;
    }

    byId.set(to, {
      ...target,
      dependsOn: [...new Set([...(target.dependsOn ?? []), from])],
    });
  }

  return nodes.map(node => byId.get(node.id) ?? node);
}

function resolveEntry(
  nodes: readonly WorkflowDslNode[],
  requestedEntry: string | undefined,
  diagnostics: WorkflowDiagnostic[],
  prefix: string,
): string {
  if (requestedEntry && nodes.some(node => node.id === requestedEntry)) {
    return requestedEntry;
  }

  if (requestedEntry) {
    diagnostics.push(createDiagnostic(
      WorkflowDefineDiagnosticCodes.INVALID_REFERENCE,
      "warning",
      `${prefix || "root"} 的入口 step "${requestedEntry}" 不存在，已回退到首个可导入节点`,
    ));
  }

  return nodes[0]?.id ?? "";
}

function collectEntryIds(document: WorkflowDslDocument): readonly string[] {
  if (document.entry && document.nodes.some(node => node.id === document.entry)) {
    return [document.entry];
  }

  const hasIncoming = new Set<string>();
  for (const node of document.nodes) {
    for (const dep of node.dependsOn ?? []) {
      hasIncoming.add(node.id);
      if (!document.nodes.some(candidate => candidate.id === dep)) continue;
    }
  }

  return document.nodes.filter(node => !hasIncoming.has(node.id)).map(node => node.id);
}

export { importSteps, applyNextEdges, resolveEntry, collectEntryIds };
