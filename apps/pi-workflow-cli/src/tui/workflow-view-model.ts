import type { WorkflowInteraction, WorkflowRuntimeEvent } from "@pi-workflow/core";

export type WorkflowShellStatus = "idle" | "running" | "paused" | "completed" | "failed";
export type WorkflowNodeStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowNodeViewState {
  readonly nodeId: string;
  readonly title?: string;
  readonly status: WorkflowNodeStatus;
}

export interface WorkflowToolActivity {
  readonly nodeId: string;
  readonly toolName: string;
  readonly status: "start" | "end";
}

export interface WorkflowShellSnapshot {
  readonly workflowRunId?: string;
  readonly workflowId?: string;
  readonly title?: string;
  readonly status: WorkflowShellStatus;
  readonly activeNodeId?: string;
  readonly activeNodeTitle?: string;
  readonly nodeStates: readonly WorkflowNodeViewState[];
  readonly agentTextByNode: Readonly<Record<string, string>>;
  readonly latestAgentNodeId?: string;
  readonly latestToolActivity?: WorkflowToolActivity;
  readonly pendingInteraction?: WorkflowInteraction;
  readonly latestError?: string;
  readonly finalOutput?: unknown;
}

/** 维护第一阶段 workflow shell 的稳定视图状态，避免命令层直接拼接事件分支。 */
export class WorkflowViewModel {
  private workflowRunId?: string;
  private workflowId?: string;
  private title?: string;
  private status: WorkflowShellStatus = "idle";
  private activeNodeId?: string;
  private activeNodeTitle?: string;
  private latestAgentNodeId?: string;
  private pendingInteraction?: WorkflowInteraction;
  private latestError?: string;
  private latestToolActivity?: WorkflowToolActivity;
  private finalOutput?: unknown;
  private nodeStates = new Map<string, WorkflowNodeViewState>();
  private agentTextByNode = new Map<string, string>();

  constructor(title?: string) {
    this.title = title;
  }

  apply(event: WorkflowRuntimeEvent): void {
    switch (event.type) {
      case "workflow.started":
      case "workflow.resumed":
        this.workflowRunId = event.workflowRunId;
        this.workflowId = event.workflowId;
        this.status = "running";
        break;
      case "node.started":
        this.activeNodeId = event.nodeId;
        this.activeNodeTitle = event.title ?? event.nodeId;
        this.nodeStates.set(event.nodeId, {
          nodeId: event.nodeId,
          title: event.title,
          status: "running",
        });
        break;
      case "agent.message.delta":
        this.latestAgentNodeId = event.nodeId;
        this.agentTextByNode.set(event.nodeId, `${this.agentTextByNode.get(event.nodeId) ?? ""}${event.delta}`);
        break;
      case "agent.tool.started":
        this.latestAgentNodeId = event.nodeId;
        this.latestToolActivity = {
          nodeId: event.nodeId,
          toolName: event.toolName,
          status: "start",
        };
        break;
      case "agent.tool.completed":
        this.latestAgentNodeId = event.nodeId;
        this.latestToolActivity = {
          nodeId: event.nodeId,
          toolName: event.toolName,
          status: "end",
        };
        break;
      case "node.await_input":
        this.pendingInteraction = event.interaction;
        break;
      case "node.completed":
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
        break;
      case "node.failed":
        this.nodeStates.set(event.nodeId, {
          nodeId: event.nodeId,
          title: this.nodeStates.get(event.nodeId)?.title,
          status: "failed",
        });
        this.latestError = event.error;
        this.status = "failed";
        break;
      case "workflow.paused":
        this.status = "paused";
        this.pendingInteraction = event.interaction;
        break;
      case "workflow.completed":
        this.status = "completed";
        this.pendingInteraction = undefined;
        this.finalOutput = event.finalOutput;
        break;
      case "workflow.failed":
        this.status = "failed";
        this.pendingInteraction = undefined;
        this.latestError = event.error;
        break;
    }
  }

  getSnapshot(): WorkflowShellSnapshot {
    return {
      workflowRunId: this.workflowRunId,
      workflowId: this.workflowId,
      title: this.title ?? this.workflowId,
      status: this.status,
      activeNodeId: this.activeNodeId,
      activeNodeTitle: this.activeNodeTitle,
      nodeStates: [...this.nodeStates.values()],
      agentTextByNode: Object.fromEntries(this.agentTextByNode.entries()),
      latestAgentNodeId: this.latestAgentNodeId,
      latestToolActivity: this.latestToolActivity,
      pendingInteraction: this.pendingInteraction,
      latestError: this.latestError,
      finalOutput: this.finalOutput,
    };
  }
}
