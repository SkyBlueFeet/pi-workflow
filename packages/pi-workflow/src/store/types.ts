import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { NodeExecutionResult, WorkflowArtifact } from "../artifacts/types.js";

/** 挂起的用户交互，记录等待用户输入的交互现场。 */
export interface PendingInteraction {
  readonly interactionId: string;
  readonly nodeId: string;
  readonly question: string;
  readonly input?: Readonly<Record<string, unknown>>;
}

/** 执行帧快照，记录帧 ID、类型及父子关系。 */
export interface ExecutionFrameSnapshot {
  readonly frameId: string;
  readonly frameType: string;
  readonly nodeId?: string;
  readonly parentFrameId?: string;
}

/** 工作流运行完整状态快照，包含帧栈、节点结果、共享上下文等全部运行时信息。 */
export interface WorkflowRunState {
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion?: string;
  readonly workflowDefinitionHash?: string;
  readonly status: "running" | "paused" | "completed" | "failed";
  readonly frames: readonly ExecutionFrameSnapshot[];
  readonly currentFrameId: string;
  readonly currentNodeId?: string;
  readonly completedNodeIds: readonly string[];
  readonly nodeResults: Readonly<Record<string, NodeExecutionResult>>;
  readonly sharedContext: Readonly<Record<string, unknown>>;
  readonly workflowInput: Readonly<Record<string, unknown>>;
  readonly artifacts: readonly WorkflowArtifact[];
  readonly ir: WorkflowDefinitionIR;
  readonly pendingInteraction?: PendingInteraction;
  readonly resumePolicy: "reenter-node";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 工作流运行状态摘要，用于列表展示，不包含完整运行数据。 */
export interface WorkflowRunStateSummary {
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly status: WorkflowRunState["status"];
  readonly updatedAt: string;
  readonly summary?: string;
}

/** 工作流运行存储接口，定义持久化层的读写协议。 */
export interface WorkflowRunStore {
  saveRunState(state: WorkflowRunState): Promise<void>;
  loadRunState(workflowRunId: string): Promise<WorkflowRunState | undefined>;
  listRunStates(): Promise<WorkflowRunStateSummary[]>;
  deleteRunState(workflowRunId: string): Promise<void>;
}

/** 工作流会话检查点，用于断点恢复和挂起交互的重入。 */
export interface WorkflowSessionCheckpoint {
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly nodeId?: string;
  readonly status: WorkflowRunState["status"];
  readonly interactionId?: string;
  readonly storeKey: string;
  readonly summary?: string;
  readonly updatedAt: string;
}
