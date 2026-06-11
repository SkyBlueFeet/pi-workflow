import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { buildPwbFromDirectory, dslToIr, loadPwbFile } from "@pi-workflow/core";
import type { WorkflowDiagnostic, WorkflowDslDocument } from "@pi-workflow/core";
import { buildPwbFromDocument } from "./build-helper.js";
import { createLogger } from "./logger.js";
import { createWorkflowRuntimeContext } from "../runtime/create-workflow-runtime-context.js";
import { runWorkflowWithShell } from "../workflow-runner/workflow-runner.js";

export class RunCommandExit extends Error {
  constructor(readonly exitCode: number) {
    super(`RUN_EXIT:${exitCode}`);
  }
}

function failRunCommand(exitCode: number): never {
  throw new RunCommandExit(exitCode);
}

/** run 命令负责读取工作流定义与输入，再交给统一 runtime context 和 runner 执行。 */
export async function runCommand(args: string[]): Promise<void> {
  let tempPwbPath: string | undefined;
  const debug = args.includes("--debug");
  const logger = createLogger("run", debug);

  try {
    if (args.length < 1 || args[0] === "--help") {
      printHelp();
      failRunCommand(args.length < 1 ? 1 : 0);
    }

    const flags = parseRunFlags(args);
    if (!flags.workflowPath) {
      console.error(flags.workflowPathError ?? "错误: 未指定工作流路径");
      failRunCommand(1);
    }

    const loaded = await loadWorkflowDocument(flags.workflowPath, flags.mode, debug, logger);
    tempPwbPath = loaded.tempPwbPath;
    emitDiagnostics(loaded.diagnostics, logger);
    if (loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      failRunCommand(1);
    }

    const input = readInputJson(flags.inputPath, logger);
    const ir = dslToIr(loaded.document);
    const runtimeContext = await createWorkflowRuntimeContext({
      ir,
      configPath: flags.configPath,
      isMock: flags.isMock,
      scanExtensions: flags.scanExtensions,
      yolo: flags.yolo,
      debug,
      onDebug: (message, ...rest) => logger.debug(message, ...rest),
    });

    const result = await runWorkflowWithShell({
      runtime: runtimeContext.runtime,
      ir,
      input,
      config: runtimeContext.config,
      title: loaded.document.title || loaded.document.id,
      loadRunState: (workflowRunId) => runtimeContext.store.loadRunState(workflowRunId),
    });
    if (result.exitCode !== 0) {
      failRunCommand(result.exitCode);
    }
  } catch (error) {
    if (error instanceof RunCommandExit) {
      throw error;
    }
    console.error(`运行工作流失败 ${args[0] ?? "<unknown>"}:`, error instanceof Error ? error.message : error);
    failRunCommand(1);
  } finally {
    if (tempPwbPath && existsSync(tempPwbPath)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tempPwbPath);
      logger.debug("已清理临时 bundle:", tempPwbPath);
    }
  }
}

interface RunFlags {
  readonly workflowPath?: string;
  readonly workflowPathError?: string;
  readonly inputPath?: string;
  readonly configPath?: string;
  readonly isMock: boolean;
  readonly scanExtensions: boolean;
  readonly yolo: boolean;
  readonly mode: "dir" | "json" | "bundle";
}

function parseRunFlags(args: string[]): RunFlags {
  const isDirectDir = args.includes("--dir");
  const isDirectJson = args.includes("--json");
  const pathIndex = isDirectDir ? args.indexOf("--dir") + 1 : isDirectJson ? args.indexOf("--json") + 1 : 0;
  const workflowPath = isDirectDir || isDirectJson ? args[pathIndex] : args[0];
  const inputStart = isDirectDir || isDirectJson ? pathIndex + 1 : 1;
  const inputPath = args.length > inputStart && !args[inputStart].startsWith("--") ? args[inputStart] : undefined;
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 && configIndex + 1 < args.length ? args[configIndex + 1] : undefined;

  return {
    workflowPath,
    workflowPathError: isDirectDir
      ? "错误: --dir 需要指定目录路径"
      : isDirectJson
        ? "错误: --json 需要指定 JSON 文件路径"
        : "错误: 未指定工作流路径",
    inputPath,
    configPath,
    isMock: args.includes("--mock"),
    scanExtensions: args.includes("--pi-extensions"),
    yolo: args.includes("--yolo"),
    mode: isDirectDir ? "dir" : isDirectJson ? "json" : "bundle",
  };
}

async function loadWorkflowDocument(
  workflowPath: string,
  mode: RunFlags["mode"],
  debug: boolean,
  logger: ReturnType<typeof createLogger>,
): Promise<{ document: WorkflowDslDocument; diagnostics: readonly WorkflowDiagnostic[]; tempPwbPath?: string }> {
  const resolvedPath = resolve(process.cwd(), workflowPath);
  const ext = extname(resolvedPath).toLowerCase();

  if (mode === "dir") {
    logger.debug("目录模式: 构建临时 bundle 后运行");
    const buildResult = buildPwbFromDirectory(resolvedPath, { debug });
    return loadBuiltDocument(resolvedPath, buildResult.pwbData, buildResult.diagnostics, logger);
  }

  if (mode === "json") {
    logger.debug("JSON 模式: 构建临时 bundle 后运行");
    const jsonData = JSON.parse(readFileSync(resolvedPath, "utf-8")) as Record<string, unknown>;
    const buildResult = buildPwbFromDocument(jsonData, debug);
    return loadBuiltDocument(resolvedPath, buildResult.pwbData, buildResult.diagnostics, logger);
  }

  if (ext === ".pwb") {
    logger.debug("直接运行 .pwb bundle");
    const loadResult = loadPwbFile(resolvedPath);
    return { document: loadResult.document, diagnostics: loadResult.diagnostics };
  }

  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    console.error(`错误: 目录输入 ${workflowPath} 不被直接支持。`);
    console.error("  请使用: pi-workflow run --dir <workflow-dir>");
    console.error("  或先构建: pi-workflow build <workflow-dir> && pi-workflow run <workflow-dir>.pwb");
    failRunCommand(1);
  }

  if (ext === ".json") {
    console.error(`错误: JSON 输入 ${workflowPath} 不被直接支持。`);
    console.error("  请使用: pi-workflow run --json <workflow.json>");
    failRunCommand(1);
  }

  console.error(`错误: 不支持的文件格式: ${workflowPath}`);
  failRunCommand(1);
}

function loadBuiltDocument(
  resolvedPath: string,
  pwbData: Uint8Array,
  diagnostics: readonly WorkflowDiagnostic[],
  logger: ReturnType<typeof createLogger>,
): { document: WorkflowDslDocument; diagnostics: readonly WorkflowDiagnostic[]; tempPwbPath: string } {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    failRunCommand(1);
  }

  const tempPwbPath = `${resolvedPath}.tmp.pwb`;
  writeFileSync(tempPwbPath, pwbData);
  logger.debug(`临时 bundle 已生成: ${tempPwbPath} (${pwbData.length} bytes)`);
  const loadResult = loadPwbFile(tempPwbPath);
  return {
    document: loadResult.document,
    diagnostics: loadResult.diagnostics,
    tempPwbPath,
  };
}

function readInputJson(
  inputPath: string | undefined,
  logger: ReturnType<typeof createLogger>,
): Record<string, unknown> {
  if (!inputPath) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(inputPath, "utf-8")) as Record<string, unknown>;
  } catch {
    logger.warn(`无法读取输入文件 ${inputPath}`);
    return {};
  }
}

function emitDiagnostics(
  diagnostics: readonly WorkflowDiagnostic[],
  logger: ReturnType<typeof createLogger>,
): void {
  for (const diagnostic of diagnostics) {
    const prefix = diagnostic.severity === "error" ? "错误" : "警告";
    if (diagnostic.severity === "error") {
      logger.error(`${prefix} ${diagnostic.code}: ${diagnostic.message}`);
      continue;
    }
    logger.warn(`${prefix} ${diagnostic.code}: ${diagnostic.message}`);
  }
}

function printHelp(): void {
  console.log("用法: pi-workflow run <workflow.pwb> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
  console.log("  pi-workflow run --dir <workflow-dir> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
  console.log("  pi-workflow run --json <workflow.json> [input.json] [--mock] [--pi-extensions] [--config <path>] [--debug]");
}
