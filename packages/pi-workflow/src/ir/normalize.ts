import type { WorkflowDefinitionIR, WorkflowNodeIR, WorkflowEdgeIR } from "./types.js";

/**
 * 规范化工作流 IR：补全节点默认字段（dependsOn、inputBindings）、
 * 从 children 推导缺失的边、自动计算入口节点。
 *
 * @param ir 原始工作流 IR
 * @returns 规范化后的 IR
 */
export function normalizeIr(ir: WorkflowDefinitionIR): WorkflowDefinitionIR {
  return {
    ...ir,
    nodes: ir.nodes.map(normalizeNode),
    edges: deriveEdges(ir.nodes, ir.edges),
    entryNodeIds: ir.entryNodeIds.length > 0 ? ir.entryNodeIds : deriveEntryNodes(ir.nodes, ir.edges),
  };
}

/** 补全节点 IR 的默认字段：dependsOn 和 inputBindings 默认空值。 */
function normalizeNode(node: WorkflowNodeIR): WorkflowNodeIR {
  return {
    ...node,
    dependsOn: node.dependsOn ?? [],
    inputBindings: node.inputBindings ?? {},
  };
}

/** 从节点的 children 列表推导缺失的边，不覆盖已存在的边。 */
function deriveEdges(
  nodes: readonly WorkflowNodeIR[],
  existingEdges: readonly WorkflowEdgeIR[],
): WorkflowEdgeIR[] {
  const edgeSet = new Set(existingEdges.map(e => `${e.from}->${e.to}`));
  const result: WorkflowEdgeIR[] = [...existingEdges];

  for (const node of nodes) {
    if (!node.children || node.children.length === 0) continue;
    for (let i = 1; i < node.children.length; i++) {
      const from = node.children[i - 1];
      const to = node.children[i];
      const key = `${from}->${to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        result.push({ from, to });
      }
    }
  }

  return result;
}

/** 自动推导入口节点（没有任何入边的节点）。节点列表为空时返回空数组。 */
function deriveEntryNodes(
  nodes: readonly WorkflowNodeIR[],
  edges: readonly WorkflowEdgeIR[],
): string[] {
  if (nodes.length === 0) return [];
  const hasIncoming = new Set(edges.map(e => e.to));
  return nodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id);
}
