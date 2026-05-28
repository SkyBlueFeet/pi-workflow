import type { WorkflowNodeKind, WorkflowNodeIR, WorkflowDefinitionIR } from "../ir/types.js";
import type { WorkflowNodeExecutor } from "../executors/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowConfig } from "../config/types.js";
import type { ExecutionFrame } from "./frame.js";

/** 复合节点执行器接口，用于执行包含子节点的节点（如并行分支、循环体） */
export interface CompositeNodeExecutor {
  /**
   * 执行复合节点
   * @param node - 待执行的复合节点 IR
   * @param parentFrame - 父执行帧
   * @param ir - 完整的工作流定义 IR
   * @param sharedContext - 共享上下文数据
   * @param completedNodes - 已完成的节点 ID 集合
   * @param nodeResults - 各节点的执行结果映射
   * @param signal - 可选的中止信号
   */
  execute(
    node: WorkflowNodeIR,
    parentFrame: ExecutionFrame,
    ir: WorkflowDefinitionIR,
    sharedContext: Record<string, unknown>,
    completedNodes: Set<string>,
    nodeResults: Map<string, NodeExecutionResult>,
    signal?: AbortSignal,
    config?: WorkflowConfig,
  ): AsyncGenerator<WorkflowRuntimeEvent, void>;
}

/** 执行器注册表，管理节点类型到执行器的映射，支持复合执行器和回退执行器 */
export class ExecutorRegistry {
  private entries = new Map<WorkflowNodeKind, WorkflowNodeExecutor>();
  private compositeEntries = new Map<WorkflowNodeKind, CompositeNodeExecutor>();
  private fallback?: WorkflowNodeExecutor;

  /** 注册节点类型对应的执行器 */
  register(kind: WorkflowNodeKind, executor: WorkflowNodeExecutor): void {
    this.entries.set(kind, executor);
  }

  /** 注册回退执行器，当找不到特定类型的执行器时使用 */
  registerFallback(executor: WorkflowNodeExecutor): void {
    this.fallback = executor;
  }

  /**
   * 获取节点类型对应的执行器，未注册时尝试回退，否则抛出错误
   * @throws 当该类型和回退均未注册时
   */
  get(kind: WorkflowNodeKind): WorkflowNodeExecutor {
    const executor = this.entries.get(kind);
    if (executor) return executor;
    if (this.fallback) return this.fallback;
    throw new Error(`未注册节点类型的 executor: ${kind}`);
  }

  /** 注册复合节点类型对应的执行器 */
  registerComposite(kind: WorkflowNodeKind, executor: CompositeNodeExecutor): void {
    this.compositeEntries.set(kind, executor);
  }

  /** 获取复合节点类型的执行器，不存在时返回 undefined */
  getComposite(kind: WorkflowNodeKind): CompositeNodeExecutor | undefined {
    return this.compositeEntries.get(kind);
  }
}
