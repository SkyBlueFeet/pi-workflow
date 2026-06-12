import { readFileSync } from "node:fs";
import { FileWorkflowRunStore } from "@pi-workflow/core";
import { createLogger } from "./logger.js";
import { createWorkflowRuntimeContext } from "../runtime/create-workflow-runtime-context.js";
import { runWorkflowWithShell } from "../workflow-runner/workflow-runner.js";

/** resume 命令负责读取已暂停 state 与交互输入，再交给统一 runtime context 和 runner 恢复。 */
export async function resumeCommand(args: string[]): Promise<void> {
  const logger = createLogger("resume", args.includes("--debug"));

  if (args.length < 1 || args[0] === "--help") {
    printHelp();
    process.exit(args.length < 1 ? 1 : 0);
  }

  const runId = args[0];
  const inputPath = args.length > 1 && !args[1].startsWith("--") ? args[1] : undefined;
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 && configIndex + 1 < args.length ? args[configIndex + 1] : undefined;
  const interactionInput = readInteractionInput(inputPath, logger);

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

  const runtimeContext = await createWorkflowRuntimeContext({
    ir: state.ir,
    configPath,
    isMock: args.includes("--mock"),
    scanExtensions: args.includes("--pi-extensions"),
    yolo: args.includes("--yolo"),
    debug: args.includes("--debug"),
    onDebug: (message, ...rest) => logger.debug(message, ...rest),
  });
  const result = await runWorkflowWithShell({
    runtime: runtimeContext.runtime,
    state,
    interactionInput,
    config: runtimeContext.config,
    title: state.workflowId,
    display: {
      showFinalOutput: args.includes("--debug"),
    },
    loadRunState: (workflowRunId) => runtimeContext.store.loadRunState(workflowRunId),
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

function readInteractionInput(inputPath: string | undefined, logger: ReturnType<typeof createLogger>): unknown {
  if (!inputPath) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(inputPath, "utf-8"));
  } catch {
    logger.warn(`无法读取输入文件 ${inputPath}`);
    return {};
  }
}

function printHelp(): void {
  console.log("用法: pi-workflow resume <workflowRunId> [input.json] [--config <path>] [--mock]");
  console.log("  <workflowRunId>  要恢复的工作流运行 ID");
  console.log("  [input.json]      可选，交互输入 JSON 文件");
  console.log("  --config <path>   工作流配置文件（JSON/TOML）");
  console.log("  --mock            使用 Mock PI Host（跳过真实模型调用）");
}
