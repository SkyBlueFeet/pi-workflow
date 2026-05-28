import type { WorkflowDefinitionIR } from "../ir/types.js";

/** 执行计划器，负责计算帧的节点 ID 列表以及可执行的就绪节点 */
export class Planner {
  /**
   * 获取帧对应的节点 ID 列表；若帧关联了节点则返回子节点，否则返回所有顶层节点
   * @param frame - 执行帧（需包含可选的 nodeId）
   * @param ir - 工作流定义 IR
   */
  getFrameNodeIds(frame: { readonly nodeId?: string }, ir: WorkflowDefinitionIR): readonly string[] {
    if (frame.nodeId) {
      const node = ir.nodes.find(n => n.id === frame.nodeId);
      return node?.children ?? [];
    }
    return ir.nodes.map(n => n.id);
  }

  /**
   * 获取所有依赖已满足的可执行节点（未被 completedNodes 包含、且所有依赖已完成）
   * @param frameNodeIds - 帧内的节点 ID 列表
   * @param ir - 工作流定义 IR
   * @param completedNodes - 已完成的节点 ID 集合
   */
  getReadyNodes(
    frameNodeIds: readonly string[],
    ir: WorkflowDefinitionIR,
    completedNodes: ReadonlySet<string>,
  ): readonly string[] {
    const ready: string[] = [];
    for (const nodeId of frameNodeIds) {
      if (completedNodes.has(nodeId)) continue;
      const node = ir.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      if (node.dependsOn.every(dep => completedNodes.has(dep))) {
        ready.push(nodeId);
      }
    }
    return ready;
  }
}
