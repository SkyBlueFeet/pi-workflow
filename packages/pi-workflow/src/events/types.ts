import type { WorkflowArtifact } from "../artifacts/types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { SecurityDecisionEvent } from "../security/types.js";

/** 工作流与用户的交互请求，包含问题描述、期望格式及可选选项。 */
export interface WorkflowInteraction {
  readonly interactionId: string;
  readonly nodeId: string;
  readonly question: string;
  readonly expectedFormat?: string;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

/** 工作流运行时事件，覆盖工作流/帧/节点生命周期、交互、安全决策等全部运行时信息。 */
export type WorkflowRuntimeEvent = ({ readonly timestamp?: string } & (
  | { readonly type: "workflow.started"; readonly workflowRunId: string; readonly workflowId: string }
  | { readonly type: "workflow.resumed"; readonly workflowRunId: string; readonly workflowId: string }
  | { readonly type: "frame.entered"; readonly workflowRunId: string; readonly frameId: string; readonly frameType: string; readonly parentFrameId?: string }
  | { readonly type: "node.started"; readonly workflowRunId: string; readonly nodeId: string; readonly title?: string }
  | { readonly type: "node.progress"; readonly workflowRunId: string; readonly nodeId: string; readonly message: string; readonly delta?: string }
  | { readonly type: "node.await_input"; readonly workflowRunId: string; readonly nodeId: string; readonly interaction: WorkflowInteraction }
  | {
    readonly type: "node.completed";
    readonly workflowRunId: string;
    readonly nodeId: string;
    readonly input?: Readonly<Record<string, unknown>>;
    readonly output?: unknown;
    readonly contextSnapshot?: Readonly<Record<string, unknown>>;
    readonly artifacts?: readonly WorkflowArtifact[];
  }
  | { readonly type: "node.failed"; readonly workflowRunId: string; readonly nodeId: string; readonly error: string; readonly input?: Readonly<Record<string, unknown>> }
  | { readonly type: "frame.completed"; readonly workflowRunId: string; readonly frameId: string }
  | { readonly type: "workflow.paused"; readonly workflowRunId: string; readonly interaction: WorkflowInteraction }
  | { readonly type: "workflow.completed"; readonly workflowRunId: string; readonly finalOutput?: unknown }
  | { readonly type: "workflow.failed"; readonly workflowRunId: string; readonly error: string }
  | { readonly type: "security.decision"; readonly workflowRunId: string; readonly event: SecurityDecisionEvent }
));

/** 工作流运行时上下文，存放诊断信息与待处理的交互请求。 */
export interface WorkflowRuntimeContext {
  [key: string]: unknown;
  _diagnostics?: readonly WorkflowDiagnostic[];
  _openQuestions?: readonly WorkflowInteraction[];
}
