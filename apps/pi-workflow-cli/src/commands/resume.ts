import { readFileSync } from "node:fs";
import {
  WorkflowRuntime, ExecutorRegistry,
  ManualExecutor, ReturnExecutor, UnsupportedExecutor,
  FileWorkflowRunStore, AgentExecutor, MockPiHostAdapter,
  PiHostAdapter, loadWorkflowConfigFile,
} from "@pi-workflow/core";
import type { WorkflowConfig } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

/**
 * resume 命令：恢复之前暂停的工作流运行。
 * 从 FileWorkflowRunStore 加载指定 workflowRunId 的运行状态，
 * 校验状态为 paused 后，使用运行时 resume 流程继续执行。
 * 退出码：0 正常，1 参数错误、未找到运行状态或状态非 paused。
 *
 * @param args 命令行参数，args[0] 为 workflowRunId，支持 --config <path>、--mock
 */
export async function resumeCommand(args: string[]): Promise<void> {
  const logger = createLogger("resume", args.includes("--debug"));

  if (args.length < 1 || args[0] === "--help") {
    console.log("用法: pi-workflow resume <workflowRunId> [input.json] [--config <path>] [--mock]");
    console.log("  <workflowRunId>  要恢复的工作流运行 ID");
    console.log("  [input.json]      可选，交互输入 JSON 文件");
    console.log("  --config <path>   工作流配置文件（JSON/TOML）");
    console.log("  --mock            使用 Mock PI Host（跳过真实模型调用）");
    process.exit(args.length < 1 ? 1 : 0);
  }

  const runId = args[0];
  const isMock = args.includes("--mock");
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 && configIndex + 1 < args.length ? args[configIndex + 1] : undefined;
  let input: unknown = {};
  const inputPath = args.length > 1 && !args[1].startsWith("--") ? args[1] : undefined;
  if (inputPath) {
    try {
      input = JSON.parse(readFileSync(inputPath, "utf-8"));
    } catch {
      logger.warn(`无法读取输入文件 ${inputPath}`);
    }
  }

  const store = new FileWorkflowRunStore();
  const state = await store.loadRunState(runId);

  if (!state) {
    logger.error(`未找到运行状态: ${runId}`);
    process.exit(1);
  }

  if (state.status !== "paused") {
    logger.error(`运行状态不是 paused（当前: ${state.status}），无法恢复`);
    process.exit(1);
  }

  let config: WorkflowConfig | undefined;
  if (configPath) {
    try {
      const loaded = loadWorkflowConfigFile(configPath);
      config = { ...loaded.config, baseDir: loaded.baseDir };
    } catch (err) {
      logger.warn(`无法加载配置文件 ${configPath}:`, err instanceof Error ? err.message : err);
    }
  }

  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("agent", new AgentExecutor());
  registry.register("tool", new UnsupportedExecutor());
  registry.register("http", new UnsupportedExecutor());
  registry.register("if", new UnsupportedExecutor());
  registry.register("parallel", new UnsupportedExecutor());
  registry.register("loop", new UnsupportedExecutor());

  const host = isMock ? new MockPiHostAdapter() : new PiHostAdapter();
  const runtime = new WorkflowRuntime({ executorRegistry: registry, store, host });

  for await (const event of runtime.resume({ state, interactionInput: input, config })) {
    switch (event.type) {
      case "workflow.resumed":
        console.log(`工作流恢复: ${event.workflowId}`);
        break;
      case "frame.entered":
        console.log(`  帧进入: ${event.frameId} (${event.frameType})`);
        break;
      case "node.started":
        console.log(`  节点开始: ${event.nodeId}${event.title ? ` (${event.title})` : ""}`);
        break;
      case "node.completed":
        console.log(`  节点完成: ${event.nodeId}`);
        break;
      case "node.failed":
        logger.error(`节点失败: ${event.nodeId} - ${event.error}`);
        break;
      case "frame.completed":
        console.log(`  帧完成: ${event.frameId}`);
        break;
      case "workflow.completed":
        console.log(`工作流完成`);
        console.log(JSON.stringify(event.finalOutput, null, 2));
        break;
      case "workflow.paused":
        console.log(`工作流再次暂停: ${event.workflowRunId}`);
        console.log(`  使用以下命令恢复:`);
        console.log(`  pi-workflow resume ${event.workflowRunId} <input.json>`);
        break;
      case "workflow.failed":
        logger.error(`工作流失败: ${event.error}`);
        process.exit(1);
        break;
    }
  }
}
