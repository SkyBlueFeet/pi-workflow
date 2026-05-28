import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowRunState } from "../store/types.js";
import type { WorkflowInteraction } from "../events/types.js";
import type { ExecutionFrame } from "./frame.js";

/** 复合节点类型集合 */
export const CompositeKinds = new Set(["workflow", "if", "parallel", "loop"]);

/** 将节点及其所有子节点递归标记为已完成 */
export function markSubtreeCompleted(nodeId: string, ir: WorkflowDefinitionIR, completedNodes: Set<string>): void {
  const node = ir.nodes.find(n => n.id === nodeId);
  if (!node) return;
  completedNodes.add(nodeId);
  if (node.children) {
    for (const childId of node.children) {
      markSubtreeCompleted(childId, ir, completedNodes);
    }
  }
}

/** 将节点及其所有子节点从已完成集合中递归移除 */
export function removeSubtreeFromCompleted(nodeId: string, ir: WorkflowDefinitionIR, completedNodes: Set<string>): void {
  const node = ir.nodes.find(n => n.id === nodeId);
  if (!node) return;
  completedNodes.delete(nodeId);
  if (node.children) {
    for (const childId of node.children) {
      removeSubtreeFromCompleted(childId, ir, completedNodes);
    }
  }
}

/** 创建工作流运行状态快照，用于持久化暂停现场 */
export function createRunState(
  runId: string,
  ir: WorkflowDefinitionIR,
  pausedNodeId: string,
  interaction: WorkflowInteraction,
  completedNodes: Set<string>,
  nodeResults: Map<string, NodeExecutionResult>,
  sharedContext: Record<string, unknown>,
  workflowInput: Record<string, unknown> = {},
  activeFrame?: ExecutionFrame,
): WorkflowRunState {
  const now = new Date().toISOString();
  const frameSnapshot = activeFrame
    ? [{ frameId: activeFrame.frameId, frameType: activeFrame.frameType, nodeId: activeFrame.nodeId, parentFrameId: activeFrame.parentFrameId }]
    : [{ frameId: `${runId}/root`, frameType: "root" as const }];
  return {
    workflowRunId: runId,
    workflowId: ir.id,
    workflowVersion: ir.version,
    workflowDefinitionHash: `${Date.now()}-${ir.nodes.length}`,
    status: "paused",
    frames: frameSnapshot,
    currentFrameId: activeFrame?.frameId ?? `${runId}/root`,
    currentNodeId: pausedNodeId,
    completedNodeIds: [...completedNodes],
    nodeResults: Object.fromEntries(nodeResults),
    sharedContext: { ...sharedContext },
    workflowInput: { ...workflowInput },
    artifacts: [...nodeResults.values()].flatMap(r => r.artifacts ?? []),
    ir,
    pendingInteraction: {
      interactionId: interaction.interactionId,
      nodeId: pausedNodeId,
      question: interaction.question,
    },
    resumePolicy: "reenter-node",
    createdAt: now,
    updatedAt: now,
  };
}
