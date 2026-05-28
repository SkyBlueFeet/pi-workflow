import type { WorkflowDefinitionIR } from "../ir/types.js";
import type { WorkflowRuntimeEvent, WorkflowInteraction } from "../events/types.js";
import type { WorkflowHostCapabilities } from "../host/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { ExecutionContext } from "../executors/types.js";
import type { WorkflowRunState, WorkflowRunStore } from "../store/types.js";
import type { WorkflowConfig } from "../config/types.js";
import type { SecurityDecisionEvent } from "../security/types.js";
import type { WorkflowRunResult, WorkflowRuntime } from "./workflow-runtime.js";
import { normalizeIr } from "../ir/normalize.js";
import { validateWorkflowConfig } from "../config/validator.js";
import { ValueResolver } from "./value-resolver.js";
import { Planner } from "./planner.js";
import { Scheduler } from "./scheduler.js";
import { FrameManager } from "./frame-manager.js";
import { ExecutorRegistry } from "./executor-registry.js";
import { ArtifactManager } from "../artifacts/artifact-manager.js";
import { EventRecorder } from "../events/recorder.js";
import { AwaitInputError } from "./errors.js";
import { SecurityAuditor } from "../security/auditor.js";
import { clearRunScopedApprovals } from "../security/approval-store.js";
import { createRunState } from "./runtime-execution-utils.js";
import { NodeExecutor } from "./runtime-node-executor.js";
import { CompositeExecutor } from "./runtime-composite-executor.js";

export interface RuntimeExecutorOptions {
  readonly host: WorkflowHostCapabilities;
  readonly executorRegistry: ExecutorRegistry;
  readonly store?: WorkflowRunStore;
  readonly runtime: WorkflowRuntime;
}

export class RuntimeExecutor {
  private host: WorkflowHostCapabilities;
  private executorRegistry: ExecutorRegistry;
  private store?: WorkflowRunStore;
  private runtime: WorkflowRuntime;
  private valueResolver = new ValueResolver();
  private planner = new Planner();
  private scheduler = new Scheduler(this.planner);
  private frameManager = new FrameManager();
  private artifactManager = new ArtifactManager();
  private eventRecorder = new EventRecorder();
  private securityAuditor = new SecurityAuditor();
  private runIdCounter = 0;
  private subRunDepth = 0;
  private nodeExecutor!: NodeExecutor;
  private compositeExecutor!: CompositeExecutor;

  constructor(options: RuntimeExecutorOptions) {
    this.host = options.host;
    this.executorRegistry = options.executorRegistry;
    this.store = options.store;
    this.runtime = options.runtime;

    this.nodeExecutor = new NodeExecutor({
      host: this.host,
      valueResolver: this.valueResolver,
      scheduler: this.scheduler,
      executorRegistry: this.executorRegistry,
      artifactManager: this.artifactManager,
      eventRecorder: this.eventRecorder,
      securityAuditor: this.securityAuditor,
      runtime: this.runtime,
      executeCompositeNode: (node, pf, ir, sc, cn, nr, sig, cfg) => this.compositeExecutor!.executeCompositeNode(node, pf, ir, sc, cn, nr, sig, cfg),
    });
    this.compositeExecutor = new CompositeExecutor({
      executorRegistry: this.executorRegistry,
      valueResolver: this.valueResolver,
      emit: event => this.nodeExecutor.emit(event),
      executeFrame: (frame, ir, sc, cn, nr, sig, cfg) => this.nodeExecutor.executeFrame(frame, ir, sc, cn, nr, sig, cfg),
      executePrimitiveNode: (node, frame, ir, sc, cn, nr, sig, cfg) => this.nodeExecutor.executePrimitiveNode(node, frame, ir, sc, cn, nr, sig, cfg),
    });
    this.compositeExecutor.registerBuiltinComposites(this.executorRegistry);
  }

  registerBuiltinComposites(executorRegistry: ExecutorRegistry): void {
    this.compositeExecutor.registerBuiltinComposites(executorRegistry);
  }

  async *run(ir: WorkflowDefinitionIR, input?: Record<string, unknown>, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult> {
    const normalizedIr = normalizeIr(ir);
    const validation = validateWorkflowConfig(normalizedIr, config);
    if (!validation.valid) {
      const msg = validation.errors.map(e => `  - [${e.nodeId}] ${e.field}: ${e.message}`).join("\n");
      yield* this.nodeExecutor.emit({ type: "workflow.failed", workflowRunId: "pre-check", error: `运行前校验失败:\n${msg}` });
      return { finalOutput: { error: `运行前校验失败:\n${msg}` } };
    }
    return yield* this.runInternal(normalizedIr, input, { signal, config });
  }

  private async *runInternal(
    ir: WorkflowDefinitionIR,
    input?: Record<string, unknown>,
    options?: { signal?: AbortSignal; config?: WorkflowConfig; parentRunId?: string; silent?: boolean },
  ): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult> {
    const runId = this.nextRunId();
    const sharedContext: Record<string, unknown> = input ? { ...input } : {};
    const completedNodes = new Set<string>();
    const nodeResults = new Map<string, NodeExecutionResult>();
    const abortController = new AbortController();
    const rootFrame = this.frameManager.createRootFrame(runId, ir.id, sharedContext);
    const signal = options?.signal;
    const config = options?.config;
    this.nodeExecutor.initSecurityAuditor(config);

    const onAbort = () => abortController.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      yield* this.nodeExecutor.emit({ type: "workflow.started", workflowRunId: runId, workflowId: ir.id }, options?.silent);
      yield* this.nodeExecutor.executeFrame(rootFrame, ir, sharedContext, completedNodes, nodeResults, abortController.signal, config, options?.silent);
      yield* this.nodeExecutor.emitSecurityEvents(runId, options?.silent);
      yield* this.nodeExecutor.emit({ type: "workflow.completed", workflowRunId: runId, finalOutput: sharedContext }, options?.silent);
      return { finalOutput: sharedContext };
    } catch (err) {
      if (err instanceof AwaitInputError) {
        const pausedNodeId = err.pausedNodeId ?? "unknown";
        const interaction: WorkflowInteraction = { interactionId: `${runId}/interaction/${pausedNodeId}`, nodeId: pausedNodeId, question: err.message };
        const state = createRunState(runId, ir, pausedNodeId, interaction, completedNodes, nodeResults, sharedContext, input ?? {}, rootFrame);
        if (this.store) await this.store.saveRunState(state);
        yield* this.nodeExecutor.emit({ type: "node.await_input", workflowRunId: runId, nodeId: pausedNodeId, interaction }, options?.silent);
        yield* this.nodeExecutor.emit({ type: "workflow.paused", workflowRunId: runId, interaction }, options?.silent);
        return { finalOutput: { _pause: true, workflowRunId: runId, interactionId: interaction.interactionId } };
      }
      yield* this.nodeExecutor.emitSecurityEvents(runId, options?.silent);
      const msg = err instanceof Error ? err.message : String(err);
      yield* this.nodeExecutor.emit({ type: "workflow.failed", workflowRunId: runId, error: msg }, options?.silent);
      return { finalOutput: { error: msg } };
    } finally {
      clearRunScopedApprovals(runId);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async *resume(state: WorkflowRunState, interactionInput: unknown, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult> {
    const completedNodes = new Set(state.completedNodeIds);
    const nodeResults = new Map(Object.entries(state.nodeResults));
    const sharedContext: Record<string, unknown> = { ...state.sharedContext };
    const ir = state.ir;
    const abortController = new AbortController();
    const workflowInput = state.workflowInput ?? {};
    const rootFrame = this.frameManager.createRootFrame(state.workflowRunId, ir.id, sharedContext);

    const onAbort = () => abortController.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      yield* this.nodeExecutor.emit({ type: "workflow.resumed", workflowRunId: state.workflowRunId, workflowId: ir.id });

      if (state.pendingInteraction) {
        const nodeId = state.pendingInteraction.nodeId;
        const node = ir.nodes.find(n => n.id === nodeId);
        if (!node) throw new Error(`恢复失败：暂停节点 "${nodeId}" 在当前 IR 中不存在（IR 版本 ${ir.version}）`);

        const resolvedInput = this.valueResolver.resolveBindings(node.inputBindings, {}, sharedContext, nodeResults, {});
        if (interactionInput !== undefined) Object.assign(resolvedInput, interactionInput as Record<string, unknown>);
        delete resolvedInput["_nodeId"];

        const ctx: ExecutionContext = {
          runId: state.workflowRunId, nodeId: node.id, nodeInput: resolvedInput, sharedContext,
          host: this.host, signal: abortController.signal, config, runtime: this.runtime,
        };
        const executor = this.executorRegistry.get(node.kind);
        const result = await executor.execute(node, ctx);
        nodeResults.set(node.id, result);
        completedNodes.add(node.id);
        if (result.artifacts) this.artifactManager.mergeAll(sharedContext, result.artifacts);
        yield* this.nodeExecutor.emit({
          type: "node.completed", workflowRunId: state.workflowRunId, nodeId: node.id,
          input: resolvedInput, output: result.output, contextSnapshot: { ...sharedContext }, artifacts: result.artifacts,
        });
      }

      yield* this.nodeExecutor.executeFrame(rootFrame, ir, sharedContext, completedNodes, nodeResults, abortController.signal, config);
      yield* this.nodeExecutor.emitSecurityEvents(state.workflowRunId);
      yield* this.nodeExecutor.emit({ type: "workflow.completed", workflowRunId: state.workflowRunId, finalOutput: sharedContext });
      return { finalOutput: sharedContext };
    } catch (err) {
      if (err instanceof AwaitInputError) {
        const pausedNodeId = err.pausedNodeId ?? "unknown";
        const interaction: WorkflowInteraction = {
          interactionId: `${state.workflowRunId}/interaction/${pausedNodeId}`,
          nodeId: pausedNodeId, question: err.message,
        };
        const newState = createRunState(state.workflowRunId, ir, pausedNodeId, interaction, completedNodes, nodeResults, sharedContext, workflowInput, rootFrame);
        if (this.store) await this.store.saveRunState(newState);
        yield* this.nodeExecutor.emit({ type: "node.await_input", workflowRunId: state.workflowRunId, nodeId: interaction.nodeId, interaction });
        yield* this.nodeExecutor.emit({ type: "workflow.paused", workflowRunId: state.workflowRunId, interaction });
        return { finalOutput: { _pause: true, workflowRunId: state.workflowRunId, interactionId: interaction.interactionId } };
      }
      yield* this.nodeExecutor.emitSecurityEvents(state.workflowRunId);
      const msg = err instanceof Error ? err.message : String(err);
      yield* this.nodeExecutor.emit({ type: "workflow.failed", workflowRunId: state.workflowRunId, error: msg });
      return { finalOutput: { error: msg } };
    } finally {
      clearRunScopedApprovals(state.workflowRunId);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async runSubWorkflow(ir: WorkflowDefinitionIR, input: Record<string, unknown>, options: { parentRunId: string; signal?: AbortSignal; maxDepth: number; config?: WorkflowConfig }): Promise<WorkflowRunResult> {
    if (options.signal?.aborted) throw new Error("子工作流已被取消");
    if (this.subRunDepth >= options.maxDepth) throw new Error(`递归深度超限 (最大: ${options.maxDepth})`);
    this.subRunDepth++;
    try {
      const gen = this.runInternal(ir, input, {
        parentRunId: options.parentRunId,
        signal: options.signal,
        config: options.config,
        silent: true,
      });
      const iter = gen[Symbol.asyncIterator]();
      let next = await iter.next();
      while (!next.done) next = await iter.next();
      return next.value;
    } finally {
      this.subRunDepth--;
    }
  }

  getEventTrace(): readonly WorkflowRuntimeEvent[] {
    return [...this.eventRecorder.events];
  }

  getSecurityAudit(runId?: string): readonly SecurityDecisionEvent[] {
    if (runId) return this.securityAuditor.getEventsByRun(runId);
    return this.securityAuditor.getEvents();
  }

  private nextRunId(): string {
    this.runIdCounter++;
    return `run-${Date.now()}-${this.runIdCounter}`;
  }
}
