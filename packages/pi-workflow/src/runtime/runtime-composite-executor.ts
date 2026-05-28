import type { WorkflowDefinitionIR, WorkflowNodeIR } from "../ir/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowConfig } from "../config/types.js";
import type { ExecutionFrame } from "./frame.js";
import type { ExecutorRegistry } from "./executor-registry.js";
import { ValueResolver } from "./value-resolver.js";
import { ConcurrencyLimiter } from "./concurrency.js";
import { CompositeKinds, markSubtreeCompleted, removeSubtreeFromCompleted } from "./runtime-execution-utils.js";

type CtorExecFn = (node: WorkflowNodeIR, pf: ExecutionFrame, ir: WorkflowDefinitionIR, sc: Record<string, unknown>, cn: Set<string>, nr: Map<string, NodeExecutionResult>, sig: AbortSignal | undefined, cfg: WorkflowConfig | undefined) => AsyncGenerator<WorkflowRuntimeEvent, void>;
type FrameExecFn = (frame: ExecutionFrame, ir: WorkflowDefinitionIR, sc: Record<string, unknown>, cn: Set<string>, nr: Map<string, NodeExecutionResult>, sig: AbortSignal | undefined, cfg: WorkflowConfig | undefined) => AsyncGenerator<WorkflowRuntimeEvent, void>;

export interface CompositeExecutorDeps {
  executorRegistry: ExecutorRegistry;
  valueResolver: ValueResolver;
  emit: (event: WorkflowRuntimeEvent) => AsyncGenerator<WorkflowRuntimeEvent, void>;
  executeFrame: FrameExecFn;
  executePrimitiveNode: CtorExecFn;
}

export class CompositeExecutor {
  constructor(private deps: CompositeExecutorDeps) {}

  registerBuiltinComposites(executorRegistry: ExecutorRegistry): void {
    executorRegistry.registerComposite("workflow", { execute: this.executeWorkflowComposite.bind(this) });
    executorRegistry.registerComposite("if", { execute: this.executeIfComposite.bind(this) });
    executorRegistry.registerComposite("parallel", { execute: this.executeParallelComposite.bind(this) });
    executorRegistry.registerComposite("loop", { execute: this.executeLoopComposite.bind(this) });
  }

  async *executeCompositeNode(node: WorkflowNodeIR, parentFrame: ExecutionFrame, ir: WorkflowDefinitionIR, sharedContext: Record<string, unknown>, completedNodes: Set<string>, nodeResults: Map<string, NodeExecutionResult>, signal?: AbortSignal, _config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, void> {
    if (signal?.aborted) return;
    const composite = this.deps.executorRegistry.getComposite(node.kind);
    if (composite) {
      yield* composite.execute(node, parentFrame, ir, sharedContext, completedNodes, nodeResults, signal, _config);
      return;
    }
    throw new Error(`未注册复合节点 executor: ${node.kind}`);
  }

  private async *executeWorkflowComposite(node: WorkflowNodeIR, parentFrame: ExecutionFrame, ir: WorkflowDefinitionIR, sharedContext: Record<string, unknown>, completedNodes: Set<string>, nodeResults: Map<string, NodeExecutionResult>, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, void> {
    yield* this.deps.emit({ type: "node.started", workflowRunId: parentFrame.runId, nodeId: node.id, title: node.title });
    const childFrame: ExecutionFrame = {
      frameId: `${parentFrame.runId}/children/${node.id}`, runId: parentFrame.runId, parentFrameId: parentFrame.frameId,
      frameType: "subworkflow", workflowId: ir.id, nodeId: node.id, input: { ...sharedContext }, status: "running",
    };
    yield* this.deps.executeFrame(childFrame, ir, sharedContext, completedNodes, nodeResults, signal, config);
    completedNodes.add(node.id);
    yield* this.deps.emit({ type: "node.completed", workflowRunId: parentFrame.runId, nodeId: node.id });
  }

  private async *executeIfComposite(node: WorkflowNodeIR, parentFrame: ExecutionFrame, ir: WorkflowDefinitionIR, sharedContext: Record<string, unknown>, completedNodes: Set<string>, nodeResults: Map<string, NodeExecutionResult>, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, void> {
    yield* this.deps.emit({ type: "node.started", workflowRunId: parentFrame.runId, nodeId: node.id, title: node.title });
    const condition = node.control?.condition ? this.deps.valueResolver.resolve(node.control.condition, parentFrame.input, sharedContext, nodeResults, parentFrame.localState ?? {}) : true;
    const children = node.children ?? [];
    if (condition) {
      const childFrame: ExecutionFrame = {
        frameId: `${parentFrame.runId}/if/${node.id}`, runId: parentFrame.runId, parentFrameId: parentFrame.frameId,
        frameType: "subworkflow", workflowId: ir.id, nodeId: node.id, input: { ...sharedContext }, status: "running",
      };
      yield* this.deps.executeFrame(childFrame, ir, sharedContext, completedNodes, nodeResults, signal, config);
    } else {
      for (const childId of children) markSubtreeCompleted(childId, ir, completedNodes);
    }
    completedNodes.add(node.id);
    yield* this.deps.emit({ type: "node.completed", workflowRunId: parentFrame.runId, nodeId: node.id });
  }

  private async *executeParallelComposite(node: WorkflowNodeIR, parentFrame: ExecutionFrame, ir: WorkflowDefinitionIR, sharedContext: Record<string, unknown>, completedNodes: Set<string>, nodeResults: Map<string, NodeExecutionResult>, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, void> {
    if (signal?.aborted) return;
    const children = node.children ?? [];
    const maxConcurrency = node.control?.maxConcurrency ?? children.length;
    const limiter = new ConcurrencyLimiter(maxConcurrency);
    const runBranch = async (childId: string): Promise<{ childId: string; events: WorkflowRuntimeEvent[]; error?: Error }> => {
      if (signal?.aborted) return { childId, events: [] };
      const childNode = ir.nodes.find(n => n.id === childId);
      if (!childNode) return { childId, events: [] };
      const branchFrame: ExecutionFrame = {
        frameId: `${parentFrame.runId}/parallel/${node.id}/${childId}`, runId: parentFrame.runId, parentFrameId: parentFrame.frameId,
        frameType: "parallel-branch", workflowId: ir.id, nodeId: childId, input: { ...sharedContext }, localState: { branchId: childId }, status: "running",
      };
      const events: WorkflowRuntimeEvent[] = [];
      try {
        if (CompositeKinds.has(childNode.kind)) {
          for await (const evt of this.executeCompositeNode(childNode, branchFrame, ir, sharedContext, completedNodes, nodeResults, signal, config)) events.push(evt);
        } else {
          for await (const evt of this.deps.executePrimitiveNode(childNode, branchFrame, ir, sharedContext, completedNodes, nodeResults, signal, config)) events.push(evt);
        }
      } catch (err) {
        return { childId, events, error: err instanceof Error ? err : new Error(String(err)) };
      }
      completedNodes.add(childId);
      return { childId, events };
    };
    const branchTasks = children.filter(id => !completedNodes.has(id)).map(id => () => runBranch(id));
    const results = await limiter.runAll(branchTasks, signal);
    const errors: Error[] = [];
    const eventMap = new Map<string, WorkflowRuntimeEvent[]>();
    for (const r of results) {
      if (r.error) errors.push(r.error);
      eventMap.set(r.childId, r.events);
    }
    for (const childId of children) {
      const evts = eventMap.get(childId);
      if (evts) { for (const evt of evts) yield evt; }
    }
    if (errors.length > 0) {
      const msg = errors.map(e => e.message).join("; ");
      yield* this.deps.emit({ type: "node.failed", workflowRunId: parentFrame.runId, nodeId: node.id, error: msg });
      const failStrategy = node.control?.failStrategy ?? "all";
      if (failStrategy === "any") throw errors[0];
      throw new AggregateError(errors, `并行节点 ${node.id} 有 ${errors.length} 个分支失败: ${msg}`);
    }
    completedNodes.add(node.id);
    yield* this.deps.emit({ type: "node.completed", workflowRunId: parentFrame.runId, nodeId: node.id });
  }

  private async *executeLoopComposite(node: WorkflowNodeIR, parentFrame: ExecutionFrame, ir: WorkflowDefinitionIR, sharedContext: Record<string, unknown>, completedNodes: Set<string>, nodeResults: Map<string, NodeExecutionResult>, signal?: AbortSignal, config?: WorkflowConfig): AsyncGenerator<WorkflowRuntimeEvent, void> {
    yield* this.deps.emit({ type: "node.started", workflowRunId: parentFrame.runId, nodeId: node.id, title: node.title });
    const items = node.control?.loopOver ? this.deps.valueResolver.resolve(node.control.loopOver, parentFrame.input, sharedContext, nodeResults, parentFrame.localState ?? {}) as unknown[] : [];
    const itemName = node.control?.itemName ?? "item";
    const children = node.children ?? [];
    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) return;
      for (const childId of children) { completedNodes.delete(childId); removeSubtreeFromCompleted(childId, ir, completedNodes); }
      const localState: Record<string, unknown> = { ...parentFrame.localState, [itemName]: items[i], iterationIndex: i };
      const loopFrame: ExecutionFrame = {
        frameId: `${parentFrame.runId}/loop/${node.id}/iter-${i}`, runId: parentFrame.runId, parentFrameId: parentFrame.frameId,
        frameType: "loop-body", workflowId: ir.id, nodeId: node.id, input: { ...sharedContext }, localState, status: "running",
      };
      for (const childId of children) {
        if (signal?.aborted) return;
        const childNode = ir.nodes.find(n => n.id === childId);
        if (!childNode) throw new Error(`循环节点 "${node.id}" 的子节点 "${childId}" 在 IR 中不存在`);
        if (CompositeKinds.has(childNode.kind)) {
          yield* this.executeCompositeNode(childNode, loopFrame, ir, sharedContext, completedNodes, nodeResults, signal, config);
        } else {
          yield* this.deps.executePrimitiveNode(childNode, loopFrame, ir, sharedContext, completedNodes, nodeResults, signal, config);
        }
      }
    }
    completedNodes.add(node.id);
    yield* this.deps.emit({ type: "node.completed", workflowRunId: parentFrame.runId, nodeId: node.id });
  }
}
