import { readFileSync, statSync } from "node:fs";
import {
  loadFromDirectory,
  loadFromObject,
  dslToIr,
  loadWorkflowConfigFile,
  validateWorkflowConfig,
} from "@pi-workflow/core";
import type { WorkflowConfig, WorkflowDiagnostic, WorkflowDslDocument } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

const logger = createLogger("policy");

/**
 * policy 命令：查看安全配置或对工作流执行安全预检。
 * 支持 `show <config-path>` 与 `check <workflow-path> --config <path>` 两个子命令。
 */
export async function policyCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help") {
    printHelp();
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand === "show") {
    showPolicy(args.slice(1));
    return;
  }

  if (subcommand === "check") {
    checkPolicy(args.slice(1));
    return;
  }

  logger.error(`未知 policy 子命令: ${subcommand}`);
  printHelp();
  process.exit(1);
}

function showPolicy(args: string[]): void {
  const configPath = args[0];
  if (!configPath) {
    logger.error("用法: pi-workflow policy show <config-path>");
    process.exit(1);
  }

  const config = loadConfigOrExit(configPath);
  if (!config.security) {
    logger.info("当前配置未声明 security，运行时将对高风险能力采用默认拒绝策略。");
    return;
  }

  console.log(JSON.stringify(config.security, null, 2));
}

function checkPolicy(args: string[]): void {
  const workflowPath = args[0];
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 && configIndex + 1 < args.length ? args[configIndex + 1] : undefined;

  if (!workflowPath || !configPath) {
    logger.error("用法: pi-workflow policy check <workflow-path> --config <config-path>");
    process.exit(1);
  }

  const config = loadConfigOrExit(configPath);
  const { document, diagnostics } = loadWorkflowDocument(workflowPath);
  const blockingDiagnostics = diagnostics.filter((item) => item.severity === "error");
  if (blockingDiagnostics.length > 0) {
    for (const item of blockingDiagnostics) {
      logger.error(`[DSL 错误] ${item.code}: ${item.message}`);
    }
    process.exit(1);
  }

  const result = validateWorkflowConfig(dslToIr(document), config, config.baseDir);
  if (!result.valid) {
    for (const error of result.errors) {
      logger.error(`[预检失败] [${error.nodeId}] ${error.field}: ${error.message}`);
    }
    process.exit(1);
  }

  logger.info("安全预检通过");
}

function loadConfigOrExit(configPath: string): WorkflowConfig {
  try {
    const loaded = loadWorkflowConfigFile(configPath);
    return { ...loaded.config, baseDir: loaded.baseDir };
  } catch (err) {
    logger.error(`无法加载配置文件 ${configPath}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

function loadWorkflowDocument(workflowPath: string): {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
} {
  const stats = statSync(workflowPath);
  if (stats.isDirectory()) {
    return loadFromDirectory(workflowPath);
  }

  const workflowJson = JSON.parse(readFileSync(workflowPath, "utf-8")) as Record<string, unknown>;
  return loadFromObject(workflowJson);
}

function printHelp(): void {
  console.log("用法: pi-workflow policy show <config-path>");
  console.log("      pi-workflow policy check <workflow-path> --config <config-path>");
}
