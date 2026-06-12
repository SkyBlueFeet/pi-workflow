import type { WorkflowInteraction, WorkflowRuntimeEvent } from "@pi-workflow/core";

/** 展示层事件类型，屏蔽 runtime 的帧级与安全审计细节，只暴露终端显示所需的语义。 */
export type WorkflowDisplayEvent =
  | { readonly type: "display.workflow.started"; readonly workflowRunId: string; readonly workflowId: string }
  | { readonly type: "display.workflow.resumed"; readonly workflowRunId: string; readonly workflowId: string }
  | { readonly type: "display.node.started"; readonly workflowRunId: string; readonly nodeId: string; readonly title?: string }
  | { readonly type: "display.node.progress"; readonly workflowRunId: string; readonly nodeId: string; readonly message: string; readonly delta?: string }
  | { readonly type: "display.agent.message.delta"; readonly workflowRunId: string; readonly nodeId: string; readonly delta: string }
  | { readonly type: "display.agent.tool.started"; readonly workflowRunId: string; readonly nodeId: string; readonly toolName: string }
  | { readonly type: "display.agent.tool.completed"; readonly workflowRunId: string; readonly nodeId: string; readonly toolName: string }
  | { readonly type: "display.node.await_input"; readonly workflowRunId: string; readonly nodeId: string; readonly interaction: WorkflowInteraction }
  | { readonly type: "display.node.completed"; readonly workflowRunId: string; readonly nodeId: string }
  | { readonly type: "display.node.failed"; readonly workflowRunId: string; readonly nodeId: string; readonly error: string }
  | { readonly type: "display.workflow.paused"; readonly workflowRunId: string; readonly interaction: WorkflowInteraction }
  | { readonly type: "display.workflow.completed"; readonly workflowRunId: string; readonly finalOutput?: unknown }
  | { readonly type: "display.workflow.failed"; readonly workflowRunId: string; readonly error: string };

/**
 * 将 runtime 事件收敛为展示协议事件。
 * 忽略 frame/security 等不应耦合到终端渲染的底层细节。
 */
export function mapRuntimeEventToDisplayEvents(event: WorkflowRuntimeEvent): readonly WorkflowDisplayEvent[] {
  switch (event.type) {
    case "workflow.started":
      return [{ type: "display.workflow.started", workflowRunId: event.workflowRunId, workflowId: event.workflowId }];
    case "workflow.resumed":
      return [{ type: "display.workflow.resumed", workflowRunId: event.workflowRunId, workflowId: event.workflowId }];
    case "node.started":
      return [{
        type: "display.node.started",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        title: event.title,
      }];
    case "node.progress":
      return [{
        type: "display.node.progress",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        message: event.message,
        delta: event.delta,
      }];
    case "agent.message.delta":
      return [{
        type: "display.agent.message.delta",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        delta: event.delta,
      }];
    case "agent.tool.started":
      return [{
        type: "display.agent.tool.started",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        toolName: event.toolName,
      }];
    case "agent.tool.completed":
      return [{
        type: "display.agent.tool.completed",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        toolName: event.toolName,
      }];
    case "node.await_input":
      return [{
        type: "display.node.await_input",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        interaction: event.interaction,
      }];
    case "node.completed":
      return [{ type: "display.node.completed", workflowRunId: event.workflowRunId, nodeId: event.nodeId }];
    case "node.failed":
      return [{
        type: "display.node.failed",
        workflowRunId: event.workflowRunId,
        nodeId: event.nodeId,
        error: event.error,
      }];
    case "workflow.paused":
      return [{
        type: "display.workflow.paused",
        workflowRunId: event.workflowRunId,
        interaction: event.interaction,
      }];
    case "workflow.completed":
      return [{
        type: "display.workflow.completed",
        workflowRunId: event.workflowRunId,
        finalOutput: event.finalOutput,
      }];
    case "workflow.failed":
      return [{
        type: "display.workflow.failed",
        workflowRunId: event.workflowRunId,
        error: event.error,
      }];
    default:
      return [];
  }
}
