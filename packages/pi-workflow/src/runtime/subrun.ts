import type { WorkflowConfig } from "../config/types.js";
import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { WorkflowRuntime } from "./workflow-runtime.js";

/** 子工作流执行选项 */
export interface SubRunOptions {
  /** 父运行 ID */
  readonly parentRunId: string;
  /** 可选的中止信号 */
  readonly signal?: AbortSignal;
  /** 最大嵌套深度 */
  readonly maxDepth: number;
  /** 可选的工作流配置覆盖 */
  readonly config?: WorkflowConfig;
}

/**
 * 在工作流运行时中执行子工作流
 * @param runtime - 工作流运行时实例
 * @param workflow - 子工作流定义 IR
 * @param input - 子工作流入参
 * @param options - 子运行选项
 * @returns 子工作流的最终输出
 */
export async function executeSubWorkflow(
  runtime: WorkflowRuntime,
  workflow: WorkflowDefinitionIR,
  input: Record<string, unknown>,
  options: SubRunOptions,
): Promise<{ finalOutput: unknown }> {
  return runtime.runSubWorkflow(workflow, input, options);
}
