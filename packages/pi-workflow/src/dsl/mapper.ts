import type { WorkflowDslDocument, WorkflowDslNode, DslValue } from "./types.js";
import type { WorkflowDefinitionIR, WorkflowNodeIR, WorkflowEdgeIR, ValueRef } from "../ir/types.js";
import { normalizeDslValue, normalizeDslControl } from "./path-expr.js";

/**
 * 将 DSL 文档转换为 IR 中间表示。
 *
 * @param doc 已校验的 DSL 文档
 * @returns 标准化后的工作流 IR
 */
export function dslToIr(doc: WorkflowDslDocument): WorkflowDefinitionIR {
  const irNodes: WorkflowNodeIR[] = doc.nodes.map(dslNodeToIrNode);
  const irEdges: WorkflowEdgeIR[] = collectEdges(doc);
  const entryNodeIds = resolveEntryNodes(doc, irEdges);
  const returnNode = doc.nodes.find(n => n.executor.type === "return");

  return {
    id: doc.id,
    version: doc.version,
    title: doc.title,
    entryNodeIds,
    nodes: irNodes,
    edges: irEdges,
    finalOutput: returnNode?.output
      ? { to: returnNode.output.to, mergeStrategy: returnNode.output.mergeStrategy }
      : undefined,
  };
}

function normalizeInputs(inputs: Readonly<Record<string, DslValue>> | undefined): Record<string, ValueRef> {
  if (!inputs) return {};
  const result: Record<string, ValueRef> = {};
  for (const [key, val] of Object.entries(inputs)) {
    result[key] = normalizeDslValue(val);
  }
  return result;
}

function dslNodeToIrNode(dsl: WorkflowDslNode): WorkflowNodeIR {
  return {
    id: dsl.id,
    title: dsl.title ?? dsl.id,
    kind: dsl.executor.type,
    dependsOn: [...(dsl.dependsOn ?? [])],
    inputBindings: normalizeInputs(dsl.inputs),
    output: dsl.output ? { ...dsl.output } : undefined,
    children: dsl.children ? [...dsl.children] : undefined,
    control: normalizeDslControl(dsl.control as Record<string, unknown> | undefined) as import("../ir/types.js").WorkflowControlIR | undefined,
    executor: { ...dsl.executor },
    capabilities: dsl.capabilities ? { ...dsl.capabilities } : undefined,
    missingInput: dsl.missingInput ? { ...dsl.missingInput } : undefined,
  };
}

function collectEdges(
  doc: WorkflowDslDocument,
): WorkflowEdgeIR[] {
  const seen = new Set<string>();
  const edges: WorkflowEdgeIR[] = [];

  function add(from: string, to: string): void {
    const key = `${from}->${to}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from, to });
    }
  }

  for (const node of doc.nodes) {
    if (node.dependsOn) {
      for (const dep of node.dependsOn) add(dep, node.id);
    }
  }

  for (const node of doc.nodes) {
    if (node.children && node.children.length > 1) {
      for (let i = 1; i < node.children.length; i++) {
        add(node.children[i - 1], node.children[i]);
      }
    }
  }

  return edges;
}

function resolveEntryNodes(doc: WorkflowDslDocument, edges: WorkflowEdgeIR[]): string[] {
  if (doc.entry) return [doc.entry];
  const hasIncoming = new Set(edges.map(e => e.to));
  return doc.nodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id);
}
