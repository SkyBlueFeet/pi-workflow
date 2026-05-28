import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowHostCapabilities } from "../host/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowConfig } from "../config/types.js";

import type { WorkflowRuntime } from "../runtime/workflow-runtime.js";

/** 节点执行上下文，包含运行 ID、节点 ID、输入数据、宿主功能、配置和运行时引用 */
export interface ExecutionContext {
  /** 运行 ID */
  readonly runId: string;
  /** 当前执行的节点 ID */
  readonly nodeId: string;
  /** 节点输入数据（已解析绑定后的值） */
  readonly nodeInput: Readonly<Record<string, unknown>>;
  /** 共享上下文数据 */
  readonly sharedContext: Readonly<Record<string, unknown>>;
  /** 宿主能力接口 */
  readonly host: WorkflowHostCapabilities;
  /** 可选的中止信号 */
  readonly signal?: AbortSignal;
  /** 可选的工作流配置 */
  readonly config?: WorkflowConfig;
  /** 工作流运行时引用（用于子工作流等递归调用） */
  readonly runtime?: WorkflowRuntime;
}

/** 工作流节点执行器接口，所有基本节点类型需要实现此接口 */
export interface WorkflowNodeExecutor {
  /**
   * 执行节点并返回执行结果
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   */
  execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult>;
}

/** 可流式输出的节点执行器接口，扩展自 WorkflowNodeExecutor，支持通过 AsyncGenerator 逐步产生事件并最终返回结果 */
export interface StreamableNodeExecutor extends WorkflowNodeExecutor {
  /**
   * 流式执行节点，yield 运行时事件，最终 return 执行结果
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   * @yields WorkflowRuntimeEvent 事件（如 node.progress）
   * @returns 节点执行结果（NodeExecutionResult）
   */
  executeStreaming?(
    node: WorkflowNodeIR,
    context: ExecutionContext,
  ): AsyncGenerator<WorkflowRuntimeEvent, NodeExecutionResult>;
}
