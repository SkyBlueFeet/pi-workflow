import type { WorkflowRunTrace } from "../events/trace.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import { buildTrace } from "../events/trace.js";
import type { WorkflowDefinitionIR } from "../ir/types.js";

/** 工作流执行跟踪的汇总模型。 */
export interface WorkflowTraceModel {
  readonly trace: WorkflowRunTrace;
  readonly ir: WorkflowDefinitionIR;
  readonly durationMs: number;
  readonly completedNodeCount: number;
  readonly failedNodeCount: number;
  readonly totalNodeCount: number;
}

/**
 * 从运行时事件与 IR 构建执行跟踪汇总模型。
 *
 * @param events 运行时事件列表
 * @param ir 工作流 IR
 * @returns 跟踪模型
 */
export function buildTraceModel(
  events: readonly WorkflowRuntimeEvent[],
  ir: WorkflowDefinitionIR,
): WorkflowTraceModel {
  const trace = buildTrace(events);
  const durationMs = computeDurationMs(trace);
  const failedNodeCount = trace.nodes.filter(n => n.status === "failed").length;
  const completedNodeCount = trace.nodes.filter(n => n.status === "completed").length;

  return {
    trace,
    ir,
    durationMs,
    completedNodeCount,
    failedNodeCount,
    totalNodeCount: trace.nodes.length,
  };
}

function computeDurationMs(trace: WorkflowRunTrace): number {
  if (!trace.startedAt) return 0;
  const end = trace.completedAt ?? new Date().toISOString();
  return new Date(end).getTime() - new Date(trace.startedAt).getTime();
}
