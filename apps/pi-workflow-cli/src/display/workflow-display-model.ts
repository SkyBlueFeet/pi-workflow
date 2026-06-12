import type { WorkflowInteraction } from "@pi-workflow/core";
import type { WorkflowDisplayEvent } from "./workflow-display-events.js";

export type WorkflowDisplayStatus = "idle" | "running" | "paused" | "completed" | "failed";
export type WorkflowNodeStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowNodeDisplayState {
  readonly nodeId: string;
  readonly title?: string;
  readonly status: WorkflowNodeStatus;
}

export interface WorkflowToolDisplayState {
  readonly nodeId: string;
  readonly toolName: string;
  readonly status: "running" | "completed";
}

export interface WorkflowDisplaySnapshot {
  readonly workflowRunId?: string;
  readonly workflowId?: string;
  readonly title?: string;
  readonly status: WorkflowDisplayStatus;
  readonly activeNodeId?: string;
  readonly activeNodeTitle?: string;
  readonly nodeStates: readonly WorkflowNodeDisplayState[];
  readonly latestStatusText?: string;
  readonly latestAgentNodeId?: string;
  readonly latestAgentText?: string;
  readonly latestToolActivity?: WorkflowToolDisplayState;
  readonly pendingInteraction?: WorkflowInteraction;
  readonly latestError?: string;
  readonly finalOutput?: unknown;
}

/** 维护展示层稳定快照，避免 renderer 直接处理 runtime 事件分支。 */
export class WorkflowDisplayModel {
  private workflowRunId?: string;
  private workflowId?: string;
  private title?: string;
  private status: WorkflowDisplayStatus = "idle";
  private activeNodeId?: string;
  private activeNodeTitle?: string;
  private latestStatusText?: string;
  private latestAgentNodeId?: string;
  private latestToolActivity?: WorkflowToolDisplayState;
  private pendingInteraction?: WorkflowInteraction;
  private latestError?: string;
  private finalOutput?: unknown;
  private nodeStates = new Map<string, WorkflowNodeDisplayState>();
  private agentTextByNode = new Map<string, string>();

  constructor(title?: string) {
    this.title = title;
  }

  apply(event: WorkflowDisplayEvent): void {
    switch (event.type) {
      case "display.workflow.started":
      case "display.workflow.resumed":
        this.workflowRunId = event.workflowRunId;
        this.workflowId = event.workflowId;
        this.status = "running";
        this.latestStatusText = event.type === "display.workflow.started" ? "工作流已启动" : "工作流已恢复";
        break;
      case "display.node.started":
        this.activeNodeId = event.nodeId;
        this.activeNodeTitle = event.title ?? event.nodeId;
        this.status = "running";
        this.latestStatusText = `正在执行 ${event.title ?? event.nodeId}`;
        this.nodeStates.set(event.nodeId, {
          nodeId: event.nodeId,
          title: event.title,
          status: "running",
        });
        break;
      case "display.node.progress":
        this.latestStatusText = event.message;
        if (event.delta) {
          this.latestAgentNodeId = event.nodeId;
          this.appendAgentText(event.nodeId, event.delta);
        }
        break;
      case "display.agent.message.delta":
        this.latestAgentNodeId = event.nodeId;
        this.appendAgentText(event.nodeId, event.delta);
        this.latestStatusText = `节点 ${event.nodeId} 正在输出`;
        break;
      case "display.agent.tool.started":
        this.latestAgentNodeId = event.nodeId;
        this.latestToolActivity = {
          nodeId: event.nodeId,
          toolName: event.toolName,
          status: "running",
        };
        this.latestStatusText = `正在调用工具 ${event.toolName}`;
        break;
      case "display.agent.tool.completed":
        this.latestAgentNodeId = event.nodeId;
        this.latestToolActivity = {
          nodeId: event.nodeId,
          toolName: event.toolName,
          status: "completed",
        };
        this.latestStatusText = `工具 ${event.toolName} 已完成`;
        break;
      case "display.node.await_input":
        this.pendingInteraction = event.interaction;
        this.latestStatusText = `节点 ${event.nodeId} 等待输入`;
        break;
      case "display.node.completed":
        this.nodeStates.set(event.nodeId, {
          nodeId: event.nodeId,
          title: this.nodeStates.get(event.nodeId)?.title,
          status: "completed",
        });
        if (this.pendingInteraction?.nodeId === event.nodeId) {
          this.pendingInteraction = undefined;
        }
        if (this.activeNodeId === event.nodeId) {
          this.activeNodeId = undefined;
          this.activeNodeTitle = undefined;
        }
        this.latestStatusText = `节点 ${event.nodeId} 已完成`;
        break;
      case "display.node.failed":
        this.nodeStates.set(event.nodeId, {
          nodeId: event.nodeId,
          title: this.nodeStates.get(event.nodeId)?.title,
          status: "failed",
        });
        this.status = "failed";
        this.latestError = event.error;
        this.latestStatusText = `节点 ${event.nodeId} 执行失败`;
        break;
      case "display.workflow.paused":
        this.status = "paused";
        this.pendingInteraction = event.interaction;
        this.latestStatusText = `工作流已暂停，等待节点 ${event.interaction.nodeId} 输入`;
        break;
      case "display.workflow.completed":
        this.status = "completed";
        this.pendingInteraction = undefined;
        this.finalOutput = event.finalOutput;
        this.latestStatusText = "工作流已完成";
        break;
      case "display.workflow.failed":
        this.status = "failed";
        this.pendingInteraction = undefined;
        this.latestError = event.error;
        this.latestStatusText = "工作流执行失败";
        break;
    }
  }

  getSnapshot(): WorkflowDisplaySnapshot {
    const latestAgentText = this.latestAgentNodeId
      ? this.agentTextByNode.get(this.latestAgentNodeId)
      : undefined;

    return {
      workflowRunId: this.workflowRunId,
      workflowId: this.workflowId,
      title: this.title ?? this.workflowId,
      status: this.status,
      activeNodeId: this.activeNodeId,
      activeNodeTitle: this.activeNodeTitle,
      nodeStates: [...this.nodeStates.values()],
      latestStatusText: this.latestStatusText,
      latestAgentNodeId: this.latestAgentNodeId,
      latestAgentText,
      latestToolActivity: this.latestToolActivity,
      pendingInteraction: this.pendingInteraction,
      latestError: this.latestError,
      finalOutput: this.finalOutput,
    };
  }

  private appendAgentText(nodeId: string, delta: string): void {
    this.agentTextByNode.set(nodeId, `${this.agentTextByNode.get(nodeId) ?? ""}${delta}`);
  }
}
