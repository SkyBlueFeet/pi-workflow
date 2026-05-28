import type { WorkflowRuntimeEvent } from "./types.js";
import type { WorkflowArtifact } from "../artifacts/types.js";

/** 执行帧跟踪记录，记录帧的进入与完成时间。 */
export interface WorkflowTraceFrame {
  readonly frameId: string;
  readonly frameType: string;
  readonly parentFrameId?: string;
  readonly enteredAt?: string;
  readonly completedAt?: string;
}

/** 节点执行跟踪记录，包含状态变化时间线及产出物。 */
export interface WorkflowTraceNode {
  readonly nodeId: string;
  readonly title?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "skipped";
  readonly error?: string;
  readonly artifacts?: readonly WorkflowArtifact[];
}

/** 完整的工作流运行跟踪，汇总事件、帧、节点及产出物。 */
export interface WorkflowRunTrace {
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: "running" | "paused" | "completed" | "failed";
  readonly events: readonly WorkflowRuntimeEvent[];
  readonly frames: readonly WorkflowTraceFrame[];
  readonly nodes: readonly WorkflowTraceNode[];
  readonly artifacts: readonly WorkflowArtifact[];
}

/**
 * 将运行时事件列表构建为结构化的工作流运行跟踪。
 * 按时间顺序处理事件，聚合帧、节点状态与产出物。
 *
 * @param events 运行时事件列表
 * @returns 构建后的运行跟踪
 */
export function buildTrace(events: readonly WorkflowRuntimeEvent[]): WorkflowRunTrace {
  let workflowRunId = "";
  let workflowId = "";
  let startedAt = "";
  let completedAt: string | undefined;
  let status: WorkflowRunTrace["status"] = "running";

  const frames: WorkflowTraceFrame[] = [];
  const nodes = new Map<string, WorkflowTraceNode>();
  const artifacts: WorkflowArtifact[] = [];

  for (const event of events) {
    switch (event.type) {
      case "workflow.started":
        workflowRunId = event.workflowRunId;
        workflowId = event.workflowId;
        startedAt = event.timestamp ?? new Date().toISOString();
        break;

      case "workflow.completed":
        completedAt = event.timestamp ?? new Date().toISOString();
        status = "completed";
        break;

      case "workflow.failed":
        completedAt = event.timestamp ?? new Date().toISOString();
        status = "failed";
        break;

      case "workflow.paused":
        status = "paused";
        break;

      case "frame.entered":
        frames.push({
          frameId: event.frameId,
          frameType: event.frameType,
          parentFrameId: event.parentFrameId,
          enteredAt: event.timestamp ?? new Date().toISOString(),
        });
        break;

      case "frame.completed": {
        const index = frames.findIndex(f => f.frameId === event.frameId);
        if (index >= 0) {
          frames[index] = { ...frames[index], completedAt: event.timestamp ?? new Date().toISOString() };
        }
        break;
      }

      case "node.started":
        nodes.set(event.nodeId, {
          nodeId: event.nodeId,
          title: event.title,
          startedAt: event.timestamp ?? new Date().toISOString(),
          status: "running",
        });
        break;

      case "node.progress": {
        const progressNode = nodes.get(event.nodeId);
        if (progressNode && progressNode.status === "running") {
          nodes.set(event.nodeId, { ...progressNode });
        }
        break;
      }

      case "node.await_input": {
        const awaitNode = nodes.get(event.nodeId);
        if (awaitNode) {
          nodes.set(event.nodeId, { ...awaitNode, status: "running" });
        } else {
          nodes.set(event.nodeId, {
            nodeId: event.nodeId,
            status: "running",
          });
        }
        break;
      }

      case "node.completed": {
        const completedNode = nodes.get(event.nodeId) ?? {
          nodeId: event.nodeId,
          status: "running" as const,
        };
        const nodeArtifacts = event.artifacts ?? [];
        nodes.set(event.nodeId, {
          ...completedNode,
          completedAt: event.timestamp ?? new Date().toISOString(),
          status: "completed",
          artifacts: nodeArtifacts,
        });
        artifacts.push(...nodeArtifacts);
        break;
      }

      case "node.failed": {
        const failedNode = nodes.get(event.nodeId) ?? {
          nodeId: event.nodeId,
          status: "running" as const,
        };
        nodes.set(event.nodeId, {
          ...failedNode,
          completedAt: event.timestamp ?? new Date().toISOString(),
          status: "failed",
          error: event.error,
        });
        break;
      }
    }
  }

  return {
    workflowRunId,
    workflowId,
    startedAt,
    completedAt,
    status,
    events: [...events],
    frames,
    nodes: [...nodes.values()],
    artifacts,
  };
}
