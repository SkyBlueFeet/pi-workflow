import type { WorkflowDefinitionIR, WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowHostCapabilities } from "../host/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { ExecutionContext, StreamableNodeExecutor } from "../executors/types.js";
import type { WorkflowConfig } from "../config/types.js";
import type { ExecutionFrame } from "./frame.js";
import type { WorkflowRuntime } from "./workflow-runtime.js";
import type { PermissionCapability } from "../security/types.js";
import { ValueResolver } from "./value-resolver.js";
import { Scheduler } from "./scheduler.js";
import { ExecutorRegistry } from "./executor-registry.js";
import { ArtifactManager } from "../artifacts/artifact-manager.js";
import { EventRecorder } from "../events/recorder.js";
import { AwaitInputError } from "./errors.js";
import { withTimeout, withTimeoutStreaming } from "./timeout.js";
import { withRetry, withRetryStreaming } from "./retry.js";
import { SecurityAuditor } from "../security/auditor.js";
import { evaluateCapability } from "../security/policy.js";
import { requestPermissionApproval } from "../security/permission-request.js";
import { CompositeKinds } from "./runtime-execution-utils.js";

export interface NodeExecutorDeps {
  host: WorkflowHostCapabilities;
  valueResolver: ValueResolver;
  scheduler: Scheduler;
  executorRegistry: ExecutorRegistry;
  artifactManager: ArtifactManager;
  eventRecorder: EventRecorder;
  securityAuditor: SecurityAuditor;
  runtime: WorkflowRuntime;
  executeCompositeNode: (
    node: WorkflowNodeIR,
    parentFrame: ExecutionFrame,
    ir: WorkflowDefinitionIR,
    sharedContext: Record<string, unknown>,
    completedNodes: Set<string>,
    nodeResults: Map<string, NodeExecutionResult>,
    signal: AbortSignal | undefined,
    config: WorkflowConfig | undefined,
  ) => AsyncGenerator<WorkflowRuntimeEvent, void>;
}

export class NodeExecutor {
  constructor(private deps: NodeExecutorDeps) {}

  initSecurityAuditor(config?: WorkflowConfig): void {
    this.deps.securityAuditor.clear();
    if (config?.security?.audit) {
      this.deps.securityAuditor.setAuditConfig(config.security.audit);
    }
  }

  async checkNodePermission(node: WorkflowNodeIR, config: WorkflowConfig | undefined, runId: string): Promise<{ allowed: boolean; reason?: string }> {
    // tool 节点的实际权限由宿主适配器 callTool() 根据工具声明的 capability（fs.read / fs.write 等）做细粒度检查，
    // 运行时层不再对所有 tool 节点统一按 process.execute 拦截，避免误拦中风险工具（如 read/grep/find/ls）。
    const capabilityMap: Partial<Record<string, PermissionCapability>> = {
      "http": "network.request",
      "agent": "extension.execute",
    };
    const requiredCap = capabilityMap[node.kind];
    if (!requiredCap) return { allowed: true };
    const piHost = this.deps.host as import("../adapters/pi/types.js").WorkflowPiHostCapabilities;
    const actorType = node.kind === "http" ? "tool" : (node.kind === "tool" ? "tool" : (node.kind === "agent" ? "agent" : "workflow"));
    const result = evaluateCapability(config?.security, requiredCap);
    this.deps.securityAuditor.record(runId, requiredCap, result.allowed ? "allow" : "deny", result.reason, { nodeId: node.id, actorType });
    if (!result.allowed) {
      const approval = await requestPermissionApproval({
        runId,
        nodeId: node.id,
        capability: requiredCap,
        reason: result.reason,
        actorLabel: `节点 ${node.id}`,
        resource: node.kind,
        cwd: config?.baseDir,
        requestUserInput: piHost.requestUserInput?.bind(piHost),
      });
      if (approval.granted) {
        const approvalReason = describeApprovalMode(approval.mode);
        this.deps.securityAuditor.record(runId, requiredCap, "allow", approvalReason, { nodeId: node.id, actorType });
        return { allowed: true, reason: approvalReason };
      }
    }
    return { allowed: result.allowed, reason: result.reason };
  }

  async *executeFrame(
    frame: ExecutionFrame,
    ir: WorkflowDefinitionIR,
    sharedContext: Record<string, unknown>,
    completedNodes: Set<string>,
    nodeResults: Map<string, NodeExecutionResult>,
    signal?: AbortSignal,
    config?: WorkflowConfig,
    silent = false,
  ): AsyncGenerator<WorkflowRuntimeEvent, void> {
    if (signal?.aborted) return;
    yield* this.emit({
      type: "frame.entered", workflowRunId: frame.runId, frameId: frame.frameId,
      frameType: frame.frameType, parentFrameId: frame.parentFrameId,
    }, silent);
    const execCompositeNode = this.deps.executeCompositeNode;
    const execPrimitiveNode = this.executePrimitiveNode.bind(this);
    yield* this.deps.scheduler.execute(frame, ir, completedNodes, signal, async function*(nodeId) {
      if (signal?.aborted) return;
      if (completedNodes.has(nodeId)) return;
      const node = ir.nodes.find(n => n.id === nodeId)!;
      if (CompositeKinds.has(node.kind)) {
        yield* execCompositeNode(node, frame, ir, sharedContext, completedNodes, nodeResults, signal, config);
      } else {
        yield* execPrimitiveNode(node, frame, ir, sharedContext, completedNodes, nodeResults, signal, config, silent);
      }
    });
    yield* this.emit({ type: "frame.completed", workflowRunId: frame.runId, frameId: frame.frameId }, silent);
  }

  async *executePrimitiveNode(
    node: WorkflowNodeIR,
    frame: ExecutionFrame,
    ir: WorkflowDefinitionIR,
    sharedContext: Record<string, unknown>,
    completedNodes: Set<string>,
    nodeResults: Map<string, NodeExecutionResult>,
    signal?: AbortSignal,
    config?: WorkflowConfig,
    silent = false,
  ): AsyncGenerator<WorkflowRuntimeEvent, void> {
    if (signal?.aborted) return;
    const permCheck = await this.checkNodePermission(node, config, frame.runId);
    if (!permCheck.allowed) {
      const errorMsg = `安全策略拒绝: ${permCheck.reason}`;
      yield* this.emit({ type: "node.failed", workflowRunId: frame.runId, nodeId: node.id, error: errorMsg }, silent);
      throw new Error(errorMsg);
    }
    yield* this.emit({ type: "node.started", workflowRunId: frame.runId, nodeId: node.id, title: node.title }, silent);

    const resolvedInput = this.deps.valueResolver.resolveBindings(
      node.inputBindings, frame.input, sharedContext, nodeResults, frame.localState ?? {},
    );
    resolvedInput["_nodeId"] = node.id;
    const cleanInput = { ...resolvedInput };
    delete cleanInput["_nodeId"];

    const context: ExecutionContext = {
      runId: frame.runId, nodeId: node.id, nodeInput: cleanInput, sharedContext,
      host: this.deps.host, signal, config, runtime: this.deps.runtime,
    };

    let result: NodeExecutionResult;
    try {
      const executor = this.deps.executorRegistry.get(node.kind);
      const policy = node.control;
      const streamable = executor as StreamableNodeExecutor;
      if (streamable.executeStreaming) {
        if (policy?.retry) {
          result = yield* withRetryStreaming(() => {
            if (policy.timeoutMs) return withTimeoutStreaming(streamable.executeStreaming!(node, context), policy.timeoutMs, signal);
            return streamable.executeStreaming!(node, context);
          }, policy.retry, signal);
        } else if (policy?.timeoutMs) {
          result = yield* withTimeoutStreaming(streamable.executeStreaming!(node, context), policy.timeoutMs, signal);
        } else {
          result = yield* streamable.executeStreaming(node, context);
        }
      } else if (policy?.retry) {
        result = await withRetry(() => {
          let runPromise = executor.execute(node, context);
          if (policy.timeoutMs) runPromise = withTimeout(runPromise, policy.timeoutMs!, signal);
          return runPromise;
        }, policy.retry, signal);
      } else if (policy?.timeoutMs) {
        result = await withTimeout(executor.execute(node, context), policy.timeoutMs, signal);
      } else {
        result = await executor.execute(node, context);
      }
    } catch (err) {
      if (err instanceof AwaitInputError) throw new AwaitInputError(err.message, err.nodeInput, node.id);
      throw err;
    }

    nodeResults.set(node.id, result);
    completedNodes.add(node.id);
    if (result.artifacts) this.deps.artifactManager.mergeAll(sharedContext, result.artifacts);
    yield* this.emit({
      type: "node.completed", workflowRunId: frame.runId, nodeId: node.id,
      input: cleanInput, output: result.output, contextSnapshot: { ...sharedContext }, artifacts: result.artifacts,
    }, silent);
  }

  async *emit(event: WorkflowRuntimeEvent, silent = false): AsyncGenerator<WorkflowRuntimeEvent, void> {
    const stampedEvent: WorkflowRuntimeEvent = event.timestamp ? event : { ...event, timestamp: new Date().toISOString() };
    if (!silent) {
      this.deps.eventRecorder.record(stampedEvent);
    }
    await this.deps.host.emitEvent?.(stampedEvent);
    if (!silent) {
      yield stampedEvent;
    }
  }

  async *emitSecurityEvents(runId: string, silent = false): AsyncGenerator<WorkflowRuntimeEvent, void> {
    const events = this.deps.securityAuditor.getEventsByRun(runId);
    for (const evt of events) {
      if (!silent) {
        yield { type: "security.decision", workflowRunId: runId, event: evt };
      }
    }
  }
}

function describeApprovalMode(mode: import("../security/permission-request.js").PermissionApprovalResult["mode"]): string {
  switch (mode) {
    case "allow-run":
      return "用户通过 ask_user 授权本次运行";
    case "allow-persist":
      return "用户通过 ask_user 永久授权";
    case "preapproved-run":
      return "已命中本次运行的 ask_user 授权缓存";
    case "preapproved-persist":
      return "已命中持久化 trust-policy 授权";
    case "allow-once":
    default:
      return "用户通过 ask_user 授权一次";
  }
}
