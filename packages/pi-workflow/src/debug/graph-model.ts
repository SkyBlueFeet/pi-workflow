import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowDefinitionIR } from "../ir/types.js";
import { buildTrace } from "../events/trace.js";
import type { WorkflowTraceNode } from "../events/trace.js";

/** 可视化图中的单个节点状态。 */
export interface WorkflowGraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "skipped";
  readonly title?: string;
}

/** 可视化图中的边，支持依赖与父子关系。 */
export interface WorkflowGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly type: "dependency" | "parent-child";
}

/** 工作流执行图的视图模型，供可视化面板消费。 */
export interface WorkflowGraphViewModel {
  readonly nodes: readonly WorkflowGraphNode[];
  readonly edges: readonly WorkflowGraphEdge[];
  readonly selectedNodeId?: string;
}

/**
 * 基于 IR 定义与运行时事件构建图视图模型。
 * 各节点的状态从 trace 中提取。
 *
 * @param ir 工作流 IR
 * @param events 运行时事件列表
 * @returns 图视图模型
 */
export function buildGraphViewModel(
  ir: WorkflowDefinitionIR,
  events: readonly WorkflowRuntimeEvent[],
): WorkflowGraphViewModel {
  const trace = buildTrace(events);
  const nodeStatusMap = buildNodeStatusMap(trace.nodes);
  const nodes: WorkflowGraphNode[] = ir.nodes.map(irNode => ({
    id: irNode.id,
    label: irNode.title || irNode.id,
    kind: irNode.kind,
    status: nodeStatusMap.get(irNode.id) ?? "pending",
    title: irNode.title,
  }));

  const edges: WorkflowGraphEdge[] = [
    ...ir.edges.map(e => ({ from: e.from, to: e.to, type: "dependency" as const })),
    ...collectChildEdges(ir),
  ];

  return { nodes, edges };
}

function buildNodeStatusMap(
  traceNodes: readonly WorkflowTraceNode[],
): Map<string, WorkflowGraphNode["status"]> {
  const map = new Map<string, WorkflowGraphNode["status"]>();
  for (const tn of traceNodes) {
    map.set(tn.nodeId, tn.status);
  }
  return map;
}

function collectChildEdges(ir: WorkflowDefinitionIR): WorkflowGraphEdge[] {
  const edges: WorkflowGraphEdge[] = [];
  for (const node of ir.nodes) {
    if (node.children) {
      for (const childId of node.children) {
        if (ir.nodes.some(n => n.id === childId)) {
          edges.push({ from: node.id, to: childId, type: "parent-child" });
        }
      }
    }
  }
  return edges;
}
