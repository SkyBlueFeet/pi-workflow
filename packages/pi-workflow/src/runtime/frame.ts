/** 执行帧类型：根帧、子工作流帧、并行分支帧、循环体帧 */
export type FrameType = "root" | "subworkflow" | "parallel-branch" | "loop-body";

/** 执行帧，表示工作流执行过程中的一个上下文层级 */
export interface ExecutionFrame {
  /** 帧唯一标识 */
  readonly frameId: string;
  /** 所属运行 ID */
  readonly runId: string;
  /** 父帧 ID（根帧无此项） */
  readonly parentFrameId?: string;
  /** 帧类型 */
  readonly frameType: FrameType;
  /** 工作流 ID */
  readonly workflowId: string;
  /** 关联的节点 ID（根帧无此项） */
  readonly nodeId?: string;
  /** 帧输入数据 */
  readonly input: Record<string, unknown>;
  /** 帧本地状态 */
  readonly localState?: Record<string, unknown>;
  /** 帧执行状态 */
  status: "running" | "paused" | "completed" | "failed";
}
