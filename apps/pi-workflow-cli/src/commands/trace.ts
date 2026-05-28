import { readFileSync, writeFileSync } from "node:fs";
import { WorkflowRuntime, ExecutorRegistry, loadFromObject, loadFromDirectory, dslToIr } from "@pi-workflow/core";
import type { WorkflowDslDocument, WorkflowDiagnostic } from "@pi-workflow/core";
import { ManualExecutor, ReturnExecutor, UnsupportedExecutor } from "@pi-workflow/core";
import { buildTraceModel } from "@pi-workflow/core";
import type { WorkflowRuntimeEvent } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

/**
 * trace 命令：执行工作流并输出完整的运行轨迹（trace），包括各节点状态、帧栈及耗时。
 * 支持将 trace 导出为 JSON 文件。
 * 退出码：0 正常，1 参数错误或工作流定义包含错误。
 *
 * @param args 命令行参数，args[0] 为工作流路径，支持 --out <trace.json>
 */
export async function traceCommand(args: string[]): Promise<void> {
  const logger = createLogger("trace");

  if (args.length < 1 || args[0] === "--help") {
    console.log("用法: pi-workflow trace <workflow-path> [input.json] [--out trace.json]");
    process.exit(args.length < 1 ? 1 : 0);
  }

  const workflowPath = args[0];
  const inputPath = args.length > 1 && !args[1].startsWith("--") ? args[1] : undefined;
  const traceOutPath = parseArg(args, "--out");

  let document: WorkflowDslDocument;
  let diagnostics: readonly WorkflowDiagnostic[];

  try {
    const stats = await import("node:fs").then(fs => fs.statSync(workflowPath));
    if (stats.isDirectory()) {
      ({ document, diagnostics } = loadFromDirectory(workflowPath));
    } else {
      const json = JSON.parse(readFileSync(workflowPath, "utf-8")) as Record<string, unknown>;
      ({ document, diagnostics } = loadFromObject(json));
    }
  } catch (err) {
    logger.error(`无法读取工作流定义 ${workflowPath}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  for (const d of diagnostics) {
    const prefix = d.severity === "error" ? "错误" : "警告";
    if (d.severity === "error") logger.error(`${prefix} ${d.code}: ${d.message}`);
    else logger.warn(`${prefix} ${d.code}: ${d.message}`);
  }
  if (diagnostics.some(d => d.severity === "error")) {
    process.exit(1);
  }

  let input: Record<string, unknown> = {};
  if (inputPath) {
    try {
      input = JSON.parse(readFileSync(inputPath, "utf-8"));
    } catch {
      logger.warn(`无法读取输入文件 ${inputPath}`);
    }
  }

  const ir = dslToIr(document);

  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(i => i));
  registry.register("return", new ReturnExecutor());
  registry.register("agent", new UnsupportedExecutor());
  registry.register("tool", new UnsupportedExecutor());
  registry.register("http", new UnsupportedExecutor());

  const events: WorkflowRuntimeEvent[] = [];
  const runtime = new WorkflowRuntime({ executorRegistry: registry });

  for await (const event of runtime.run({ ir, input })) {
    events.push(event);
  }

  const model = buildTraceModel(events, ir);
  const trace = model.trace;

  console.log("=== Workflow Trace ===");
  console.log(`Run ID: ${trace.workflowRunId}`);
  console.log(`Workflow: ${trace.workflowId}`);
  console.log(`Status: ${trace.status}`);
  console.log(`Duration: ${model.durationMs}ms`);
  console.log(`Nodes: ${model.totalNodeCount} (completed: ${model.completedNodeCount}, failed: ${model.failedNodeCount})`);

  if (trace.nodes.length > 0) {
    console.log("\nNode Timeline:");
    for (const node of trace.nodes) {
      const icon = node.status === "completed" ? "✓" : node.status === "failed" ? "✗" : node.status === "running" ? "→" : "○";
      console.log(`  ${icon} ${node.nodeId} [${node.status}]${node.error ? ` - ${node.error}` : ""}`);
    }
  }

  if (trace.frames.length > 0) {
    console.log("\nFrame Stack:");
    for (const frame of trace.frames) {
      const indent = frame.parentFrameId ? "  " : "";
      console.log(`  ${indent}${frame.frameId} (${frame.frameType})`);
    }
  }

  const securityEvents = events.filter((event) => event.type === "security.decision");
  if (securityEvents.length > 0) {
    console.log("\nSecurity Decisions:");
    for (const event of securityEvents) {
      if (event.type !== "security.decision") {
        continue;
      }
      console.log(`  ${event.event.decision === "allow" ? "✓" : "✗"} ${event.event.actorType} ${event.event.capability}${event.event.nodeId ? ` @ ${event.event.nodeId}` : ""} - ${event.event.reason}`);
    }
  }

  if (traceOutPath) {
    writeFileSync(traceOutPath, JSON.stringify(trace, null, 2), "utf-8");
    console.log(`\nTrace 已写入: ${traceOutPath}`);
  }
}

/**
 * 从参数数组中提取指定选项的值。
 *
 * @param args 命令行参数数组
 * @param name 选项名，如 "--out"
 * @returns 选项值，未指定时返回 undefined
 */
function parseArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}
