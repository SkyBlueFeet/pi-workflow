import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { ExecutionFrame } from "./frame.js";
import { Planner } from "./planner.js";

/** 节点执行函数类型，接收节点 ID 并产生运行时事件流 */
export type NodeExecutorFn = (nodeId: string) => AsyncGenerator<WorkflowRuntimeEvent, void>;

/** 调度器，按依赖关系逐个调度帧中的就绪节点执行 */
export class Scheduler {
  /**
   * @param planner - 执行计划器，用于计算就绪节点
   */
  constructor(private planner: Planner) {}

  /**
   * 执行帧内所有就绪节点，按依赖关系依次调度
   * @param frame - 当前执行帧
   * @param ir - 工作流定义 IR
   * @param completedNodes - 已完成的节点 ID 集合
   * @param signal - 可选的中止信号
   * @param executeNode - 单节点执行函数
   */
  async *execute(
    frame: ExecutionFrame,
    ir: WorkflowDefinitionIR,
    completedNodes: Set<string>,
    signal: AbortSignal | undefined,
    executeNode: NodeExecutorFn,
  ): AsyncGenerator<WorkflowRuntimeEvent, void> {
    if (signal?.aborted) return;

    const frameNodeIds = this.planner.getFrameNodeIds(frame, ir);

    while (true) {
      if (signal?.aborted) return;
      const readyIds = this.planner.getReadyNodes(frameNodeIds, ir, completedNodes);
      if (readyIds.length === 0) break;

      for (const nodeId of readyIds) {
        if (signal?.aborted) return;
        if (completedNodes.has(nodeId)) continue;
        yield* executeNode(nodeId);
      }
    }
  }
}
