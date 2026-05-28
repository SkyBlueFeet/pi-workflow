import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { dslToIr, loadPwbFile, buildPwbFromDirectory } from "@pi-workflow/core";
import { WorkflowRuntime, ExecutorRegistry } from "@pi-workflow/core";
import { ManualExecutor, ReturnExecutor, UnsupportedExecutor, AgentExecutor, ToolExecutor, HttpExecutor } from "@pi-workflow/core";
import { FileWorkflowRunStore, MockPiHostAdapter } from "@pi-workflow/core";
import { loadWorkflowConfigFile } from "@pi-workflow/core";
import { ALL_CAPABILITIES } from "@pi-workflow/core";
import type { WorkflowDiagnostic, WorkflowDslDocument, WorkflowConfig, WorkflowSecurityConfig, WorkflowRuntimeEvent, WorkflowDefinitionIR } from "@pi-workflow/core";
import { buildPwbFromDocument } from "./build-helper.js";
import { createLogger } from "./logger.js";

class RunCommandExit extends Error {
  constructor(readonly exitCode: number) {
    super(`RUN_EXIT:${exitCode}`);
  }
}

function failRunCommand(exitCode: number): never {
  throw new RunCommandExit(exitCode);
}

/**
 * run 命令：加载并执行工作流定义文件或目录中的 flow.json。
 * 支持 mock 模式、PI 扩展扫描、YOLO 安全策略、调试输出等选项。
 * 新增支持 .pwb bundle 直接运行。
 * 退出码：0 正常，1 参数错误或工作流执行失败。
 *
 * @param args 命令行参数，args[0] 为工作流路径（.pwb / 目录 / JSON），支持 --mock、--pi-extensions、--yolo、--config <path>、--debug、--dir、--json
 */
export async function runCommand(args: string[]): Promise<void> {
  let tempPwbPath: string | undefined;
  const debug = args.includes("--debug");
  const logger = createLogger("run", debug);

  try {
  if (args.length < 1 || args[0] === "--help") {
    console.log("用法: pi-workflow run <workflow.pwb> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
    console.log("  pi-workflow run --dir <workflow-dir> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
    console.log("  pi-workflow run --json <workflow.json> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
    failRunCommand(args.length < 1 ? 1 : 0);
  }

  const isDirectDir = args.includes("--dir");
  const isDirectJson = args.includes("--json");
  const isMock = args.includes("--mock");
  const scanExtensions = args.includes("--pi-extensions");
  const yolo = args.includes("--yolo");
  const pathIndex = isDirectDir ? args.indexOf("--dir") + 1
    : isDirectJson ? args.indexOf("--json") + 1
    : 0;
  const workflowPath = isDirectDir || isDirectJson ? args[pathIndex] : args[0];
  const inputStart = isDirectDir || isDirectJson ? pathIndex + 1 : 1;
  const inputPath = args.length > inputStart && !args[inputStart].startsWith("--") ? args[inputStart] : undefined;
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 && configIndex + 1 < args.length ? args[configIndex + 1] : undefined;

  if (!workflowPath) {
    console.error(isDirectDir ? "错误: --dir 需要指定目录路径" : isDirectJson ? "错误: --json 需要指定 JSON 文件路径" : "错误: 未指定工作流路径");
    failRunCommand(1);
  }

  const yoloSecurityConfig: WorkflowSecurityConfig = {
    permissions: ALL_CAPABILITIES.map(c => ({ capability: c })),
  };

  let document: WorkflowDslDocument;
  let diagnostics: readonly WorkflowDiagnostic[];

  try {
    const resolvedPath = resolve(process.cwd(), workflowPath);
    const ext = extname(resolvedPath).toLowerCase();

    if (isDirectDir) {
      logger.debug("目录模式: 构建临时 bundle 后运行");
      const buildResult = buildPwbFromDirectory(resolvedPath, { debug });
      if (buildResult.diagnostics.some((d: WorkflowDiagnostic) => d.severity === "error")) {
        for (const d of buildResult.diagnostics) {
          logger.error(`错误 ${d.code}: ${d.message}`);
        }
        failRunCommand(1);
      }
      tempPwbPath = resolvedPath + ".tmp.pwb";
      const writeFileSync = (await import("node:fs")).writeFileSync;
      writeFileSync(tempPwbPath, buildResult.pwbData);
      logger.debug(`临时 bundle 已生成: ${tempPwbPath} (${buildResult.pwbData.length} bytes)`);
      const loadResult = loadPwbFile(tempPwbPath);
      document = loadResult.document;
      diagnostics = loadResult.diagnostics;
    } else if (isDirectJson) {
      logger.debug("JSON 模式: 构建临时 bundle 后运行");
      const jsonData = JSON.parse(readFileSync(resolvedPath, "utf-8")) as Record<string, unknown>;
      const buildResult = buildPwbFromDocument(jsonData, debug);
      if (buildResult.diagnostics.some(d => d.severity === "error")) {
        for (const d of buildResult.diagnostics) {
          logger.error(`错误 ${d.code}: ${d.message}`);
        }
        failRunCommand(1);
      }
      tempPwbPath = resolvedPath + ".tmp.pwb";
      const writeFileSync = (await import("node:fs")).writeFileSync;
      writeFileSync(tempPwbPath, buildResult.pwbData);
      logger.debug(`临时 bundle 已生成: ${tempPwbPath} (${buildResult.pwbData.length} bytes)`);
      const loadResult = loadPwbFile(tempPwbPath);
      document = loadResult.document;
      diagnostics = loadResult.diagnostics;
    } else if (ext === ".pwb") {
      logger.debug("直接运行 .pwb bundle");
      const loadResult = loadPwbFile(resolvedPath);
      document = loadResult.document;
      diagnostics = loadResult.diagnostics;
    } else if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      console.error(`错误: 目录输入 ${workflowPath} 不被直接支持。`);
      console.error(`  请使用: pi-workflow run --dir <workflow-dir>`);
      console.error(`  或先构建: pi-workflow build <workflow-dir> && pi-workflow run <workflow-dir>.pwb`);
      failRunCommand(1);
    } else if (ext === ".json") {
      console.error(`错误: JSON 输入 ${workflowPath} 不被直接支持。`);
      console.error(`  请使用: pi-workflow run --json <workflow.json>`);
      failRunCommand(1);
    } else {
      console.error(`错误: 不支持的文件格式: ${workflowPath}`);
      failRunCommand(1);
    }
  } catch (err) {
    console.error(`无法读取工作流定义 ${workflowPath}:`, err instanceof Error ? err.message : err);
    failRunCommand(1);
  }

  for (const d of diagnostics) {
    const prefix = d.severity === "error" ? "错误" : "警告";
    if (d.severity === "error") logger.error(`${prefix} ${d.code}: ${d.message}`);
    else logger.warn(`${prefix} ${d.code}: ${d.message}`);
  }
  if (diagnostics.some(d => d.severity === "error")) {
    failRunCommand(1);
  }

  let input: Record<string, unknown> = {};
  if (inputPath) {
    try {
      input = JSON.parse(readFileSync(inputPath, "utf-8"));
      logger.debug("输入数据:", JSON.stringify(input, null, 2));
    } catch {
      console.error(`警告: 无法读取输入文件 ${inputPath}`);
    }
  }

  const ir = dslToIr(document);
  const hasAgent = ir.nodes.some(n => n.kind === "agent");

  if (debug) {
    logger.debug("IR 节点:");
    for (const n of ir.nodes) {
      console.error(`  ${n.id} (${n.kind}) bindings:`, JSON.stringify(n.inputBindings));
    }
    logger.debug("IR edges:", JSON.stringify(ir.edges));
    logger.debug(`entry: ${ir.entryNodeIds}`);
  }

  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(i => i));
  registry.register("return", new ReturnExecutor());
  registry.register("tool", new ToolExecutor());
  registry.register("http", new HttpExecutor());
  registry.register("if", new UnsupportedExecutor());
  registry.register("parallel", new UnsupportedExecutor());
  registry.register("loop", new UnsupportedExecutor());

  let host;
  if (hasAgent) {
    if (isMock) {
      host = new MockPiHostAdapter();
      logger.debug("使用 Mock PI Host");
    } else {
      const { PiHostAdapter } = await import("@pi-workflow/core");

      let extensionTools: Array<{ name: string; execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }> }> | undefined;
      try {
        const { PiExtensionBridge } = await import("@pi-workflow/extension-loader");
        const bridge = new PiExtensionBridge();

        const tools: Array<{ name: string; execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }> }> = [];
        const nativeTools = bridge.getNativeTools();
        tools.push(...nativeTools.map(t => ({ name: t.name, execute: t.execute })));

        if (scanExtensions) {
          const results = await bridge.loadFromNodeModules();
          for (const t of bridge.getAllTools()) {
            tools.push({ name: t.name, execute: t.execute });
          }
          if (debug) {
            for (const r of results) {
              if (r.error) logger.debug(`扩展 ${r.packageName}: 跳过 (${r.error})`);
              else logger.debug(`扩展 ${r.packageName}: 加载 ${r.tools.length} 个工具`);
            }
          }
        }

        extensionTools = tools;
        if (debug && tools.length) {
          logger.debug(`可用工具: ${tools.map(t => t.name).join(", ")}`);
        }
      } catch (err) {
        logger.debug("桥接层不可用:", err instanceof Error ? err.message : err);
      }

      host = new PiHostAdapter({ extensionTools });
      logger.debug("使用真实 PI Host" + (extensionTools?.length ? ` (${extensionTools.length} 个扩展工具)` : ""));
    }
    registry.register("agent", new AgentExecutor());
  } else {
    registry.register("agent", new UnsupportedExecutor());
    host = undefined;
  }

  const runtime = new WorkflowRuntime({
    executorRegistry: registry,
    host: host as any,
    store: new FileWorkflowRunStore(),
  });

  let config: WorkflowConfig | undefined;
  if (configPath) {
    try {
      const loaded = loadWorkflowConfigFile(configPath);
      config = { ...loaded.config, baseDir: loaded.baseDir };
      logger.debug("加载配置文件:", configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error(`警告: 无法加载配置文件 ${configPath}:`, err instanceof Error ? err.message : err);
    }
  }

  if (yolo) {
    logger.debug("YOLO 模式：跳过安全策略检查，允许所有能力");
    config = {
      ...config,
      security: {
        ...config?.security,
        ...yoloSecurityConfig,
      },
    };
  }

  const agentNodeIds = new Set(ir.nodes.filter(n => n.kind === "agent").map(n => n.id));
  let streamingNode: string | null = null;

  const nodeTracker = debug ? new NodeTracker(ir) : null;

  console.log(`工作流: ${document.title || document.id}\n`);

  for await (const event of runtime.run({ ir, input, config })) {
    nodeTracker?.record(event);
    switch (event.type) {
      case "node.started":
        streamingNode = agentNodeIds.has(event.nodeId) ? event.nodeId : null;
        console.log(`  └─ ${event.title || event.nodeId}`);
        logger.debug("节点开始:", JSON.stringify(event));
        break;
      case "node.progress":
        if (event.nodeId === streamingNode && event.delta) {
          process.stdout.write(event.delta);
        }
        if (debug && event.nodeId !== streamingNode) {
          logger.debug("progress:", event.nodeId, event.message);
        }
        break;
      case "node.completed":
        if (streamingNode) {
          process.stdout.write("\n");
          streamingNode = null;
        }
        if (debug) {
          logger.debug("节点完成:", JSON.stringify({ nodeId: event.nodeId, output: event.output }));
          if (event.input) logger.debug("节点输入:", JSON.stringify(event.input));
        }
        break;
      case "node.failed":
        console.error(`  ✗ ${event.nodeId}: ${event.error}`);
        nodeTracker?.setFailed(event.nodeId, event.error);
        if (!debug) failRunCommand(1);
        break;
      case "workflow.completed":
        console.log(`\n结果:\n${JSON.stringify(event.finalOutput, null, 2)}`);
        if (debug) {
          logger.debug("工作流完成");
          nodeTracker!.printSummary();
        }
        break;
      case "node.await_input":
        console.log(`  ⏸ ${event.nodeId} 等待输入`);
        break;
      case "workflow.paused":
        console.log(`\n工作流已暂停 (${event.workflowRunId})`);
        console.log(`  恢复: pi-workflow resume ${event.workflowRunId}`);
        break;
      case "workflow.failed":
        console.error(`\n✗ 工作流失败: ${event.error}`);
        if (debug) nodeTracker?.printSummary();
        failRunCommand(1);
        break;
    }
  }

  } catch (err) {
    if (err instanceof RunCommandExit) {
      throw err;
    }
    console.error(`运行工作流失败 ${args[0] ?? "<unknown>"}:`, err instanceof Error ? err.message : err);
    failRunCommand(1);
  } finally {
    if (tempPwbPath && existsSync(tempPwbPath)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tempPwbPath);
      logger.debug("已清理临时 bundle:", tempPwbPath);
    }
  }
}

class NodeTracker {
  private nodes = new Map<string, {
    nodeId: string; title: string; kind: string;
    status: "pending" | "running" | "completed" | "failed";
    startedAt: number | null; completedAt: number | null;
    durationMs: number | null;
    resolvedInput: Record<string, unknown> | null;
    output: unknown; error: string | null;
    dependsOn: readonly string[];
  }>();

  constructor(ir: WorkflowDefinitionIR) {
    for (const n of ir.nodes) {
      this.nodes.set(n.id, {
        nodeId: n.id, title: n.title, kind: n.kind,
        status: "pending", startedAt: null, completedAt: null,
        durationMs: null, resolvedInput: null, output: null,
        error: null, dependsOn: n.dependsOn,
      });
    }
  }

  record(event: WorkflowRuntimeEvent): void {
    if (event.type === "node.started") {
      const info = this.nodes.get(event.nodeId);
      if (info) {
        info.status = "running";
        info.startedAt = Date.now();
      }
    } else if (event.type === "node.completed") {
      const info = this.nodes.get(event.nodeId);
      if (info) {
        info.status = "completed";
        info.completedAt = Date.now();
        info.durationMs = info.startedAt ? info.completedAt - info.startedAt : null;
        info.resolvedInput = event.input ?? null;
        info.output = event.output;
      }
    } else if (event.type === "node.failed") {
      const info = this.nodes.get(event.nodeId);
      if (info) {
        info.status = "failed";
        info.completedAt = Date.now();
        info.durationMs = info.startedAt ? info.completedAt - info.startedAt : null;
        info.error = event.error;
        info.resolvedInput = event.input ?? null;
      }
    }
  }

  setFailed(nodeId: string, error: string): void {
    const info = this.nodes.get(nodeId);
    if (info) {
      info.status = "failed";
      info.completedAt = Date.now();
      info.durationMs = info.startedAt ? info.completedAt - info.startedAt : null;
      info.error = error;
    }
  }

  printSummary(): void {
    const sorted = [...this.nodes.values()].sort(
      (a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
    );
    console.error("\n=== 节点运行追踪 ===");
    console.error(` ${"节点ID".padEnd(20)} ${"类型".padEnd(10)} ${"状态".padEnd(10)} ${"耗时".padEnd(8)} ${"依赖".padEnd(20)}`);
    console.error(" " + "─".repeat(72));
    for (const n of sorted) {
      const icon = n.status === "completed" ? "✓" : n.status === "failed" ? "✗" : n.status === "running" ? "→" : "○";
      const dur = n.durationMs !== null ? `${n.durationMs}ms` : "-";
      const deps = n.dependsOn.length ? n.dependsOn.join(",") : "-";
      console.error(` ${icon}${n.nodeId.padEnd(19)} ${n.kind.padEnd(10)} ${n.status.padEnd(10)} ${dur.padEnd(8)} ${deps.padEnd(20)}`);
      if (n.error) console.error(`  错误: ${n.error}`);
    }

    const completed = sorted.filter(n => n.status === "completed").length;
    const failed = sorted.filter(n => n.status === "failed").length;
    const total = sorted.length;
    console.error(` ${"─".repeat(72)}`);
    console.error(` 总计: ${total} | 完成: ${completed} | 失败: ${failed} | 耗时: ${this.calcTotalDuration()}ms`);
    console.error("");
  }

  private calcTotalDuration(): number {
    let min = Infinity, max = 0;
    for (const n of this.nodes.values()) {
      if (n.startedAt && n.startedAt < min) min = n.startedAt;
      if (n.completedAt && n.completedAt > max) max = n.completedAt;
    }
    return min === Infinity ? 0 : max - min;
  }
}
