#!/usr/bin/env node

import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** 加载 .env 与 .env.local 环境变量文件（不覆盖已有值）。 */
const cwd = process.cwd();
const envFiles = [".env", ".env.local"];
for (const file of envFiles) {
  const envPath = resolve(cwd, file);
  if (existsSync(envPath)) {
    dotenvConfig({ path: envPath, override: false });
  }
}

import { runCommand } from "./commands/run.js";
import { resumeCommand } from "./commands/resume.js";
import { traceCommand } from "./commands/trace.js";
import { inspectCommand } from "./commands/inspect.js";
import { pkgCommand } from "./commands/pkg.js";
import { agentCommand } from "./commands/agent.js";
import { policyCommand } from "./commands/policy.js";
import { buildCommand } from "./commands/build.js";

/** 根据命令行第一个参数路由到对应的命令处理函数。 */
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "run":
    await runCommand(args);
    break;
  case "resume":
    await resumeCommand(args);
    break;
  case "trace":
    await traceCommand(args);
    break;
  case "inspect":
    await inspectCommand(args);
    break;
  case "pkg":
    await pkgCommand(args);
    break;
  case "agent":
    await agentCommand(args);
    break;
  case "policy":
    await policyCommand(args);
    break;
  case "build":
    await buildCommand(args);
    break;
  case "--help":
  case "-h":
  default:
    console.log("pi-workflow CLI - Pi Workflow 任务编排工具");
    console.log("");
    console.log("用法:");
    console.log("  pi-workflow build <workflow-dir> [--out <file>] [--overwrite]");
    console.log("  pi-workflow run <workflow.pwb> [input.json] [--mock] [--pi-extensions]");
    console.log("  pi-workflow run --dir <workflow-dir> [input.json] [--mock] [--pi-extensions]");
    console.log("  pi-workflow run --json <workflow.json> [input.json] [--mock] [--pi-extensions]");
    console.log("  pi-workflow resume <workflowRunId> [input.json]");
    console.log("  pi-workflow trace <workflow-path> [input.json]");
    console.log("  pi-workflow inspect <workflow-path> [options]");
    console.log("  pi-workflow pkg install|list|info|uninstall");
    console.log("  pi-workflow agent list|show|resolve <id>");
    console.log("  pi-workflow policy show|check");
    console.log("");
    console.log("命令:");
    console.log("  build    将目录式 workflow 构建为 .pwb bundle");
    console.log("  run      执行工作流（.pwb / --dir / --json）");
    console.log("  resume   恢复暂停的工作流");
    console.log("  trace    执行工作流并输出完整 trace");
    console.log("  inspect  检查工作流结构、节点详情、context diff");
    console.log("  pkg      管理 PI 包 (install/list/info/uninstall)");
    console.log("  agent    列出、查看和解析智能体 (list/show/resolve)");
    console.log("  policy   查看或校验安全策略");
    console.log("");
    console.log("run 选项:");
    console.log("  --mock             使用 Mock PI Host（跳过真实模型调用）");
    console.log("  --pi-extensions    额外扫描安装的 PI extension 包并加载其工具");
    console.log("  --yolo             跳过安全策略检查，允许所有能力");
    console.log("  --config <path>    工作流配置文件（JSON）");
    console.log("  --debug            输出详细调试信息");
    break;
}
