import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowRunTrace, WorkflowTraceNode } from "../events/trace.js";
import { buildTrace } from "../events/trace.js";

/** 重放的单帧，包含截至当前索引的事件与节点状态。 */
export interface ReplayFrame {
  readonly events: readonly WorkflowRuntimeEvent[];
  readonly nodeStates: readonly WorkflowTraceNode[];
  readonly index: number;
}

/** 工作流执行事件回放器，支持逐步重放与节点时间线查询。 */
export class WorkflowReplay {
  private readonly trace: WorkflowRunTrace;

  constructor(events: readonly WorkflowRuntimeEvent[]) {
    this.trace = buildTrace(events);
  }

  /** 返回完整的执行跟踪。 */
  getTrace(): WorkflowRunTrace {
    return this.trace;
  }

  /** 生成所有历史帧的快照列表。 */
  replayAll(): ReplayFrame[] {
    return replayFrames(this.trace.events);
  }

  /**
   * 回放到指定事件索引时的状态。
   *
   * @param eventIndex 事件索引
   * @returns 该时间点的帧快照
   */
  replayToEvent(eventIndex: number): ReplayFrame {
    const events = this.trace.events.slice(0, eventIndex + 1);
    const trace = buildTrace(events);
    return {
      events,
      nodeStates: trace.nodes,
      index: eventIndex,
    };
  }

  /**
   * 获取指定节点的完整事件时间线。
   *
   * @param nodeId 节点 ID
   * @returns 该节点的所有事件
   */
  getNodeTimeline(nodeId: string): WorkflowRuntimeEvent[] {
    return this.trace.events.filter(
      event =>
        ("nodeId" in event && event.nodeId === nodeId),
    );
  }
}

/**
 * 从事件列表生成所有历史帧。
 *
 * @param events 运行时事件列表
 * @returns 帧列表（每帧对应一个事件索引）
 */
export function replayFrames(events: readonly WorkflowRuntimeEvent[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  for (let i = 0; i < events.length; i++) {
    const prefix = events.slice(0, i + 1);
    const trace = buildTrace(prefix);
    frames.push({
      events: prefix,
      nodeStates: trace.nodes,
      index: i,
    });
  }

  return frames;
}

/**
 * 创建工作流事件回放器。
 *
 * @param events 运行时事件列表
 * @returns 回放器实例
 */
export function createWorkflowReplay(events: readonly WorkflowRuntimeEvent[]): WorkflowReplay {
  return new WorkflowReplay(events);
}
