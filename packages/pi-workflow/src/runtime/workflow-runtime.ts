import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowHostCapabilities } from "../host/types.js";
import type { SecurityDecisionEvent } from "../security/types.js";
import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { WorkflowRunState, WorkflowRunStore } from "../store/types.js";
import type { WorkflowConfig } from "../config/types.js";
import { RuntimeExecutor } from "./runtime-executor.js";
import { NullWorkflowHost } from "../host/null-host.js";
import { ExecutorRegistry } from "./executor-registry.js";
import { UnsupportedExecutor } from "../executors/unsupported-executor.js";
import { AgentExecutor } from "../executors/agent-executor.js";
import { ExtractorExecutor } from "../executors/extractor-executor.js";
import { HttpExecutor } from "../executors/http-executor.js";
import { ManualExecutor } from "../executors/manual-executor.js";
import { ReturnExecutor } from "../executors/return-executor.js";
import { ToolExecutor } from "../executors/tool-executor.js";

/** 工作流运行请求 */
export interface WorkflowRunRequest {
  /** 工作流定义 IR */
  readonly ir: WorkflowDefinitionIR;
  /** 可选的运行输入 */
  readonly input?: Record<string, unknown>;
  /** 可选的中止信号 */
  readonly signal?: AbortSignal;
  /** 可选的工作流配置 */
  readonly config?: WorkflowConfig;
}

/** 工作流恢复请求 */
export interface WorkflowResumeRequest {
  /** 保存的运行状态 */
  readonly state: WorkflowRunState;
  /** 用户/外部系统提供的交互输入 */
  readonly interactionInput: unknown;
  /** 可选的中止信号 */
  readonly signal?: AbortSignal;
  /** 可选的工作流配置 */
  readonly config?: WorkflowConfig;
}

/** 工作流运行结果 */
export interface WorkflowRunResult {
  /** 最终输出数据 */
  readonly finalOutput: unknown;
}

/** 工作流运行时构造选项 */
export interface WorkflowRuntimeOptions {
  /** 宿主能力接口，用于与外部环境交互 */
  readonly host?: WorkflowHostCapabilities;
  /** 执行器注册表，未提供时将使用默认注册表和 UnsupportedExecutor 回退 */
  readonly executorRegistry?: ExecutorRegistry;
  /** 可选的运行状态存储器，用于持久化暂停状态 */
  readonly store?: WorkflowRunStore;
}

/** 工作流运行时，负责执行、暂停、恢复工作流，管理帧、调度、安全审查和事件 emit */
export class WorkflowRuntime {
  private executor: RuntimeExecutor;
  private store?: WorkflowRunStore;

  /** @param options - 运行时构造选项 */
  constructor(options: WorkflowRuntimeOptions = {}) {
    const host = options.host ?? NullWorkflowHost;
    const executorRegistry = options.executorRegistry ?? (() => {
      const reg = new ExecutorRegistry();
      reg.register("manual", new ManualExecutor(input => input));
      reg.register("return", new ReturnExecutor());
      reg.register("agent", new AgentExecutor());
      reg.register("tool", new ToolExecutor());
      reg.register("http", new HttpExecutor());
      reg.register("extractor", new ExtractorExecutor());
      reg.registerFallback(new UnsupportedExecutor());
      return reg;
    })();
    this.store = options.store;
    this.executor = new RuntimeExecutor({ host, executorRegistry, store: this.store, runtime: this });
    this.executor.registerBuiltinComposites(executorRegistry);
  }

  /**
   * 运行工作流（入口），先执行校验再调用内部执行逻辑
   * @param request - 运行请求（IR、输入、信号、配置）
   * @yields 工作流运行时事件流
   * @returns 运行结果
   */
  async *run(request: WorkflowRunRequest): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult> {
    return yield* this.executor.run(request.ir, request.input, request.signal, request.config);
  }

  /**
   * 恢复先前暂停的工作流执行，先处理暂停节点的交互输入，再继续执行剩余帧
   * @param request - 恢复请求（状态、交互输入、信号、配置）
   * @yields 运行时事件流
   * @returns 运行结果
   * @throws 当暂停节点在当前 IR 中不存在时
   */
  async *resume(request: WorkflowResumeRequest): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult> {
    return yield* this.executor.resume(request.state, request.interactionInput, request.signal, request.config);
  }

  /**
   * 在工作流内部运行子工作流，受最大递归深度限制
   * @param ir - 子工作流定义 IR
   * @param input - 子工作流入参
   * @param options - 子运行选项（父运行 ID、信号、最大深度、配置）
   * @returns 子工作流运行结果
   * @throws 递归深度超限或取消时抛出
   */
  async runSubWorkflow(
    ir: WorkflowDefinitionIR,
    input: Record<string, unknown>,
    options: { parentRunId: string; signal?: AbortSignal; maxDepth: number; config?: WorkflowConfig },
  ): Promise<WorkflowRunResult> {
    return this.executor.runSubWorkflow(ir, input, options);
  }

  /** 获取当前运行时的事件追踪记录 */
  getEventTrace(): readonly WorkflowRuntimeEvent[] {
    return this.executor.getEventTrace();
  }

  /**
   * 获取安全审计事件列表
   * @param runId - 可选，指定运行 ID 时仅返回该运行的安全事件
   */
  getSecurityAudit(runId?: string): readonly SecurityDecisionEvent[] {
    return this.executor.getSecurityAudit(runId);
  }
}
