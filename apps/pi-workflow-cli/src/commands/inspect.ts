import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { WorkflowRuntime, ExecutorRegistry, loadFromObject, loadFromDirectory, dslToIr, FileWorkflowRunStore, loadPwbFile } from "@pi-workflow/core";
import type { WorkflowDslDocument, WorkflowDiagnostic, WorkflowRuntimeEvent, WorkflowRunState } from "@pi-workflow/core";
import { ManualExecutor, ReturnExecutor, UnsupportedExecutor } from "@pi-workflow/core";
import { buildTrace, computeContextDiff, buildGraphViewModel } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

/**
 * inspect 命令：检查工作流定义的结构、节点信息、上下文 diff 或图形模型。
 * 支持加载 JSON 文件、目录中的 flow.json 或 .pwb bundle。
 * 退出码：0 正常，1 参数错误或工作流定义包含错误。
 *
 * @param args 命令行参数，args[0] 为工作流路径（.pwb / JSON / 目录）
 *   支持 --node、--context、--graph、--checkpoints、--checkpoint 等选项
 */
export async function inspectCommand(args: string[]): Promise<void> {
  const logger = createLogger("inspect");

  if (args.length < 1 || args[0] === "--help") {
    console.log("用法: pi-workflow inspect <workflow-path> [--node <node-id>] [--context] [--graph] [--checkpoints] [--checkpoint <run-id>] [--json]");
    process.exit(args.length < 1 ? 1 : 0);
  }

  const workflowPath = args[0];
  const showNodeId = parseArg(args, "--node");
  const showContext = args.includes("--context");
  const showGraph = args.includes("--graph");
  const showCheckpoints = args.includes("--checkpoints");
  const checkpointRunId = parseArg(args, "--checkpoint");
  const runsDir = parseArg(args, "--runs-dir");
  const outputJson = args.includes("--json");

  let document: WorkflowDslDocument;
  let diagnostics: readonly WorkflowDiagnostic[];
  let resourceSummary: { resources: number; totalSize: number; strategies: Record<string, number> } | undefined;

  try {
    const resolvedPath = resolve(process.cwd(), workflowPath);
    const ext = extname(resolvedPath).toLowerCase();

    if (ext === ".pwb") {
      const loadResult = loadPwbFile(resolvedPath);
      document = loadResult.document;
      diagnostics = loadResult.diagnostics;

      const manifest = loadResult.manifest;
      const totalSize = manifest.resources.reduce((s, r) => s + r.size, 0);
      const strategies: Record<string, number> = {};
      for (const r of manifest.resources) {
        strategies[r.strategy] = (strategies[r.strategy] ?? 0) + 1;
      }
      resourceSummary = {
        resources: manifest.resources.length,
        totalSize,
        strategies,
      };
    } else if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      ({ document, diagnostics } = loadFromDirectory(resolvedPath));
    } else {
      const json = JSON.parse(readFileSync(resolvedPath, "utf-8")) as Record<string, unknown>;
      ({ document, diagnostics } = loadFromObject(json));
    }
  } catch (err) {
    logger.error(`无法读取工作流定义 ${workflowPath}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (diagnostics.some(d => d.severity === "error")) {
    logger.error("工作流定义包含错误:");
    for (const d of diagnostics) {
      logger.error(`[${d.severity}] ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  const ir = dslToIr(document);

  if (showCheckpoints || checkpointRunId) {
    const store = new FileWorkflowRunStore(runsDir);
    if (showCheckpoints) {
      await printCheckpointList(store);
    }
    if (checkpointRunId) {
      const state = await store.loadRunState(checkpointRunId);
      if (!state) {
        logger.error(`未找到 checkpoint: ${checkpointRunId}`);
        process.exit(1);
      }
      printCheckpointState(state);
    }
    if (!showNodeId && !showContext && !showGraph && !outputJson) {
      return;
    }
  }

  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(i => i));
  registry.register("return", new ReturnExecutor());
  registry.register("agent", new UnsupportedExecutor());
  registry.register("tool", new UnsupportedExecutor());
  registry.register("http", new UnsupportedExecutor());

  const events: WorkflowRuntimeEvent[] = [];
  const runtime = new WorkflowRuntime({ executorRegistry: registry });

  for await (const event of runtime.run({ ir, input: {} })) {
    events.push(event);
  }

  const trace = buildTrace(events);
  const sharedContextBefore: Record<string, unknown> = {};
  const sharedContextAfter = getFinalContext(events);

  if (outputJson) {
    const output: Record<string, unknown> = {
      workflow: {
        title: document.title,
        id: document.id,
        version: document.version,
        entry: document.entry,
        nodeCount: document.nodes.length,
      },
      manifest: resourceSummary ? {
        resources: resourceSummary.resources,
        totalSize: resourceSummary.totalSize,
        strategies: resourceSummary.strategies,
      } : undefined,
      trace: {
        status: trace.status,
        nodeCount: trace.nodes.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const securityEvents = events.filter((event) => event.type === "security.decision");

  console.log("=== Workflow Inspect ===");
  console.log(`Workflow: ${document.title} (${document.id}) v${document.version}`);
  console.log(`Entry: ${document.entry}`);
  console.log(`Nodes: ${document.nodes.length}`);
  console.log(`Events: ${events.length}`);
  console.log(`Status: ${trace.status}`);
  console.log(`Security Decisions: ${securityEvents.length}`);

  if (resourceSummary) {
    console.log(`\n=== Bundle Resources ===`);
    console.log(`Total: ${resourceSummary.resources}`);
    console.log(`Total Size: ${resourceSummary.totalSize} bytes`);
    for (const [strategy, count] of Object.entries(resourceSummary.strategies)) {
      console.log(`  ${strategy}: ${count}`);
    }
  }

  console.log("\nNodes:");
  for (const node of document.nodes) {
    const traceNode = trace.nodes.find(n => n.nodeId === node.id);
    const status = traceNode?.status ?? "pending";
    const icon = status === "completed" ? "✓" : status === "failed" ? "✗" : status === "running" ? "→" : "○";
    const deps = node.dependsOn?.length ? ` deps:[${node.dependsOn.join(",")}]` : "";
    console.log(`  ${icon} ${node.id} [${node.executor.type}]${deps}`);
  }

  console.log("\nEdges:");
  for (const edge of ir.edges) {
    console.log(`  ${edge.from} -> ${edge.to}`);
  }

  if (!showNodeId && !showContext && !showGraph) {
    return;
  }

  if (showNodeId) {
    const node = document.nodes.find(n => n.id === showNodeId);
    if (!node) {
      logger.error(`节点 "${showNodeId}" 不存在`);
      process.exit(1);
    }

    const traceNode = trace.nodes.find(n => n.nodeId === showNodeId);
    const nodeEvents = events.filter(e => "nodeId" in e && e.nodeId === showNodeId);

    console.log(`\n=== Node: ${showNodeId} ===`);
    console.log(`Type: ${node.executor.type}`);
    console.log(`Title: ${node.title ?? "-"}`);
    console.log(`Status: ${traceNode?.status ?? "pending"}`);
    console.log(`DependsOn: ${node.dependsOn?.join(", ") ?? "-"}`);
    console.log(`Children: ${node.children?.join(", ") ?? "-"}`);

    if (node.inputs) {
      console.log(`\nInputs: ${JSON.stringify(node.inputs, null, 2)}`);
    }

    if (node.output) {
      console.log(`\nOutput: ${JSON.stringify(node.output, null, 2)}`);
    }

    if (nodeEvents.length > 0) {
      console.log(`\nEvents (${nodeEvents.length}):`);
      for (const evt of nodeEvents) {
        console.log(`  ${evt.timestamp ?? "-"} ${evt.type}`);
      }
    }

    const nodeSecurityEvents = events.filter((event) =>
      event.type === "security.decision" && event.event.nodeId === showNodeId,
    );
    if (nodeSecurityEvents.length > 0) {
      console.log(`\nSecurity Decisions (${nodeSecurityEvents.length}):`);
      for (const event of nodeSecurityEvents) {
        if (event.type !== "security.decision") continue;
        console.log(`  ${event.event.decision === "allow" ? "✓" : "✗"} ${event.event.capability} - ${event.event.reason}`);
      }
    }

    const completed = [...nodeEvents].reverse().find(evt => evt.type === "node.completed");
    if (completed?.type === "node.completed") {
      if (completed.input) {
        console.log(`\nResolved Input: ${JSON.stringify(completed.input, null, 2)}`);
      }
      if (completed.output !== undefined) {
        console.log(`\nRuntime Output: ${JSON.stringify(completed.output, null, 2)}`);
      }
      if (completed.artifacts?.length) {
        console.log(`\nArtifacts: ${JSON.stringify(completed.artifacts, null, 2)}`);
      }
    }
  }

  if (showContext) {
    const diff = computeContextDiff(sharedContextBefore, sharedContextAfter);
    console.log("\n=== Context Diff ===");
    if (diff.length === 0) {
      console.log("  (no changes)");
    } else {
      for (const entry of diff) {
        const icon = entry.type === "added" ? "+" : entry.type === "removed" ? "-" : "~";
        console.log(`  ${icon} ${entry.path}`);
      }
    }
  }

  if (showGraph) {
    const graph = buildGraphViewModel(ir, events);
    console.log("\n=== Graph Model ===");
    console.log(`Nodes: ${graph.nodes.length}`);
    for (const node of graph.nodes) {
      console.log(`  ${node.id} [${node.kind}] (${node.status})`);
    }
    console.log(`Edges: ${graph.edges.length}`);
    for (const edge of graph.edges) {
      console.log(`  ${edge.from} -> ${edge.to} [${edge.type}]`);
    }
  }
}

function parseArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

async function printCheckpointList(store: FileWorkflowRunStore): Promise<void> {
  const states = await store.listRunStates();
  console.log("=== Checkpoints ===");
  if (states.length === 0) {
    console.log("  (no checkpoints)");
    return;
  }
  for (const state of states) {
    console.log(`  ${state.workflowRunId} [${state.status}] workflow=${state.workflowId} updated=${state.updatedAt}`);
  }
}

function printCheckpointState(state: WorkflowRunState): void {
  console.log("=== Checkpoint ===");
  console.log(`Run ID: ${state.workflowRunId}`);
  console.log(`Workflow: ${state.workflowId}${state.workflowVersion ? ` v${state.workflowVersion}` : ""}`);
  console.log(`Status: ${state.status}`);
  console.log(`Current Node: ${state.currentNodeId ?? "-"}`);
  console.log(`Completed Nodes: ${state.completedNodeIds.join(", ") || "-"}`);
  if (state.pendingInteraction) {
    console.log(`Pending Interaction: ${state.pendingInteraction.interactionId}`);
    console.log(`Question: ${state.pendingInteraction.question}`);
  }
  console.log(`Frames: ${state.frames.length}`);
  console.log(`Artifacts: ${state.artifacts.length}`);
  console.log(`\nShared Context: ${JSON.stringify(state.sharedContext, null, 2)}`);
}

function getFinalContext(events: readonly WorkflowRuntimeEvent[]): Record<string, unknown> {
  const completed = [...events].reverse().find(event => event.type === "workflow.completed");
  if (completed?.type === "workflow.completed" && isRecord(completed.finalOutput)) {
    return completed.finalOutput;
  }

  const nodeCompleted = [...events].reverse().find(event => event.type === "node.completed" && isRecord(event.contextSnapshot));
  if (nodeCompleted?.type === "node.completed" && isRecord(nodeCompleted.contextSnapshot)) {
    return nodeCompleted.contextSnapshot;
  }

  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
