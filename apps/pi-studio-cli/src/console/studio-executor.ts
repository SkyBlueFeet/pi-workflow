/**
 * 控制台执行与诊断模块。
 *
 * 职责：
 * 1. 将控制台命令映射到宿主动作层
 * 2. 预留 workflow 执行入口接线点
 * 3. 预留 agent 执行入口接线点
 * 4. 提供执行结果的展示骨架
 */

import type { StudioConsoleState } from "./studio-state.js";
import { setLoading, setError, addMessage } from "./studio-state.js";

/** 执行动作类型。 */
export type ExecutorAction =
  | "workflow.run"
  | "workflow.resume"
  | "workflow.trace"
  | "workflow.inspect"
  | "agent.run"
  | "agent.once"
  | "agent.resolve";

/** 执行请求。 */
export interface ExecutionRequest {
  readonly action: ExecutorAction;
  readonly targetId: string;
  readonly params: Record<string, string>;
}

/** 执行结果。 */
export interface ExecutionResult {
  readonly success: boolean;
  readonly action: ExecutorAction;
  readonly targetId: string;
  readonly output?: string;
  readonly error?: string;
  readonly runId?: string;
}

/**
 * 控制台执行器接口。
 * 负责将控制台命令转换为底层工作流/agent 的执行调用。
 */
export interface StudioExecutor {
  /** 执行指定的宿主动作。 */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  /** 恢复指定的暂停运行。 */
  resume(runId: string): Promise<ExecutionResult>;
}

/** 控制台执行器骨架实现。 */
export class StudioExecutorImpl implements StudioExecutor {
  /**
   * 骨架实现：返回占位结果。
   * 后续阶段接入真实的 workflow runner、agent invoker 等执行链路。
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // TODO: 接入真实执行链路
    return {
      success: false,
      action: request.action,
      targetId: request.targetId,
      error: `执行动作 ${request.action} 尚未实现（骨架）。后续将接入真实执行链路。`,
    };
  }

  async resume(_runId: string): Promise<ExecutionResult> {
    // TODO: 接入真实 resume 链路
    return {
      success: false,
      action: "workflow.resume",
      targetId: _runId,
      error: "resume 功能尚未实现（骨架）。后续将接入真实执行链路。",
    };
  }
}

/**
 * 渲染执行结果到控制台输出。
 */
export function renderExecutionResult(result: ExecutionResult): string {
  if (result.success) {
    const lines = [
      `  执行成功: ${result.action}`,
      `  目标: ${result.targetId}`,
    ];
    if (result.runId) {
      lines.push(`  Run ID: ${result.runId}`);
    }
    if (result.output) {
      lines.push(`  输出: ${result.output.slice(0, 200)}`);
    }
    return lines.join("\n");
  }

  return `  执行失败: ${result.action} — ${result.targetId}\n  原因: ${result.error}`;
}

/**
 * 用执行器处理控制台命令的动作请求，更新状态。
 */
export async function handleExecution(
  state: StudioConsoleState,
  request: ExecutionRequest,
  executor: StudioExecutor,
): Promise<StudioConsoleState> {
  let next = setLoading(state, true);

  let result: ExecutionResult;
  try {
    result = await executor.execute(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    next = setError(setLoading(next, false), msg);
    return addMessage(next, {
      role: "system",
      content: `执行异常: ${msg}`,
      timestamp: new Date(),
    });
  }

  next = setLoading(next, false);

  if (!result.success) {
    next = setError(next, result.error ?? "未知执行错误");
  }

  return addMessage(next, {
    role: "system",
    content: renderExecutionResult(result),
    timestamp: new Date(),
  });
}
