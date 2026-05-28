import type { WorkflowOutputBindingIR } from "../ir/types.js";

/** 工作流转出物，包含类型、数据及目标合并路径和策略。 */
export interface WorkflowArtifact {
  readonly type: string;
  readonly data: unknown;
  readonly targetPath?: string;
  readonly mergeStrategy?: WorkflowOutputBindingIR["mergeStrategy"];
  readonly summary?: string;
}

/** 节点执行结果，包含节点输出及产生的所有转出物。 */
export interface NodeExecutionResult {
  readonly output: unknown;
  readonly artifacts?: readonly WorkflowArtifact[];
}
