import { readFileSync } from "node:fs";
import { createRegistryFromConfig, loadWorkflowConfigFile, CustomAgentInvoker, resolveAgentConfig } from "@pi-workflow/core";
import type { WorkflowConfig, WorkflowNodeIR } from "@pi-workflow/core";
import { createLogger } from "./logger.js";
import { resolveCliModelOverride } from "../env.js";

const logger = createLogger("agent");

function debugLog(debug: boolean, msg: string): void {
  if (debug) console.error(`\x1b[36m[pi-workflow-cli]\x1b[0m \x1b[34m[DEBUG]\x1b[0m \x1b[35m[agent]\x1b[0m ${msg}`);
}

/**
 * agent 命令入口，根据子命令路由到 list/show/resolve/run 处理函数。
 *
 * @param args 命令行参数，args[0] 为子命令名
 */
export async function agentCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case "list":
      await agentList(args.slice(1));
      break;
    case "show":
      await agentShow(args.slice(1));
      break;
    case "resolve":
      await agentResolve(args.slice(1));
      break;
    case "run":
      await agentRun(args.slice(1));
      break;
    case "once":
      await agentOnce(args.slice(1));
      break;
    default:
      console.log("pi-workflow agent - 智能体管理");
      console.log("");
      console.log("用法:");
      console.log("  pi-workflow agent list [--config <path>]           列出所有智能体");
      console.log("  pi-workflow agent show <id> [--config <path>]     查看智能体详情");
      console.log("  pi-workflow agent resolve <id> [--config <path>]  查看合并后的智能体配置");
      console.log("  pi-workflow agent run <id> [--config <path>] [--model <model>] [--debug]              启动 PI 原生界面");
      console.log("  pi-workflow agent once <id> [--config <path>] [--input <path> | --prompt <text>] [--model <model>] [--debug]  单轮执行");
      break;
  }
}

/**
 * 列出配置文件中定义的所有智能体及摘要信息。
 * 必须通过 --config 指定配置文件路径。
 * 退出码：0 正常，1 缺少配置。
 *
 * @param args 命令行参数，含 --config <path>
 */
async function agentList(args: string[]): Promise<void> {
  const configPath = extractConfigPath(args);

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  const config = loadWorkflowConfig(configPath);
  const registry = createRegistryFromConfig(config);
  const agents = registry.list();

  if (agents.length === 0) {
    logger.info("未定义任何智能体");
    return;
  }

  console.log("已配置的智能体:");
  console.log("");
  for (const agent of agents) {
    console.log(`  ${agent.id}`);
    if (agent.name) console.log(`    名称: ${agent.name}`);
    if (agent.description) console.log(`    描述: ${agent.description}`);
    console.log(`    skills: ${agent.skills?.length ?? 0}`);
    console.log(`    tools: ${agent.tools?.length ?? 0}`);
    console.log(`    workflow tools: ${Object.keys(agent.workflowOverlay.workflowTools ?? {}).length}`);
    console.log(`    mcp servers: ${agent.mcp?.length ?? 0}`);
    console.log(`    runtime: ${agent.runtimeMode}`);
    if (agent.diagnostics.length > 0) console.log(`    diagnostics: ${agent.diagnostics.length}`);
    console.log("");
  }
}

/**
 * 显示指定智能体的完整详情，包括模型、tools、skills、MCP 等配置。
 * 退出码：0 正常，1 参数错误或智能体不存在。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，含 --config <path>
 */
async function agentShow(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent show <id> --config <path>");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  const config = loadWorkflowConfig(configPath);
  const registry = createRegistryFromConfig(config);
  const agent = registry.get(agentId);

  if (!agent) {
    logger.error(`智能体 "${agentId}" 未找到`);
    process.exit(1);
  }

  console.log(`智能体: ${agent.id}`);
  if (agent.name) console.log(`  名称: ${agent.name}`);
  if (agent.description) console.log(`  描述: ${agent.description}`);
  if (agent.systemPrompt) console.log(`  系统提示: ${agent.systemPrompt.slice(0, 100)}${agent.systemPrompt.length > 100 ? "..." : ""}`);
  console.log(`  模型: ${agent.model ? `${agent.model.provider}/${agent.model.model}` : "未配置"}`);
  if (agent.model?.temperature !== undefined) console.log(`  温度: ${agent.model.temperature}`);
  if (agent.model?.maxTokens !== undefined) console.log(`  最大 Token: ${agent.model.maxTokens}`);
  console.log(`  运行面: ${agent.runtimeMode}`);
  if (agent.skills && agent.skills.length > 0) {
    console.log(`  Skills:`);
    for (const s of agent.skills) console.log(`    - ${s.name}${s.source ? ` (${s.source})` : ""}`);
  }
  if (agent.tools && agent.tools.length > 0) {
    console.log(`  Tools:`);
    for (const t of agent.tools) {
      const label = describeToolRef(t as { name: string; type?: string; extension?: string; source?: string });
      console.log(`    - ${t.name} (${label})`);
    }
  }
  if (agent.workflowOverlay.workflowTools && Object.keys(agent.workflowOverlay.workflowTools).length > 0) {
    console.log(`  Workflow Tools:`);
    for (const [name, wt] of Object.entries(agent.workflowOverlay.workflowTools)) {
      console.log(`    - ${name}${wt.description ? `: ${wt.description}` : ""}`);
      if (wt.workflowPath) console.log(`      路径: ${wt.workflowPath}`);
    }
  }
  if (agent.mcp && agent.mcp.length > 0) {
    console.log(`  MCP:`);
    for (const m of agent.mcp) console.log(`    - ${m.server}`);
  }
  if (agent.diagnostics.length > 0) {
    console.log("  Diagnostics:");
    for (const diagnostic of agent.diagnostics) {
      console.log(`    - [${diagnostic.severity}/${diagnostic.phase}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
}

/**
 * 显示指定智能体经过层级合并后的最终解析配置。
 * 基于当前配置文件构造空节点 IR，输出合并后的 skills/tools/mcp/workflowTools。
 * 退出码：0 正常，1 参数错误或智能体不存在。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，含 --config <path>
 */
async function agentResolve(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent resolve <id> --config <path>");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  const config = loadWorkflowConfig(configPath);
  const registry = createRegistryFromConfig(config);

  if (!registry.has(agentId)) {
    logger.error(`智能体 "${agentId}" 未找到`);
    process.exit(1);
  }

  const dummyNode: WorkflowNodeIR = {
    id: "_resolve",
    title: "_resolve",
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    executor: { type: "agent", config: { agentId } },
  };

  const resolved = resolveAgentConfig(dummyNode, config, registry);

  console.log(`已解析智能体: ${agentId}`);
  console.log("");
  console.log(`  系统提示: ${resolved.prompt.systemPrompt.slice(0, 120)}${resolved.prompt.systemPrompt.length > 120 ? "..." : ""}`);
  if (resolved.prompt.userPrompt) console.log(`  用户提示: ${resolved.prompt.userPrompt.slice(0, 120)}${resolved.prompt.userPrompt.length > 120 ? "..." : ""}`);
  console.log(`  模型: ${resolved.model?.id ?? "未配置"}`);
  if (resolved.model?.temperature !== undefined) console.log(`  温度: ${resolved.model.temperature}`);
  if (resolved.model?.maxTokens !== undefined) console.log(`  最大 Token: ${resolved.model.maxTokens}`);
  console.log(`  运行面: ${resolved.runtimeMode}`);
  if (resolved.skills && resolved.skills.length > 0) {
    console.log(`  Skills (${resolved.skills.length}):`);
    for (const s of resolved.skills) console.log(`    - ${s.name}${s.source ? ` (${s.source})` : ""}`);
  }
  if (resolved.tools && resolved.tools.length > 0) {
    console.log(`  Tools (${resolved.tools.length}):`);
    for (const t of resolved.tools) {
      const label = describeToolRef(t);
      console.log(`    - ${t.name} (${label})`);
    }
  }
  if (resolved.workflowTools.length > 0) {
    console.log(`  Workflow Tools (${resolved.workflowTools.length}):`);
    for (const wt of resolved.workflowTools) {
      console.log(`    - ${wt.name}${wt.description ? `: ${wt.description}` : ""}`);
      console.log(`      类型: 已解析工作流 (${wt.workflow.id})`);
    }
  }
  if (resolved.mcp && resolved.mcp.length > 0) {
    console.log(`  MCP (${resolved.mcp.length}):`);
    for (const m of resolved.mcp) console.log(`    - ${m.server}`);
  }
  if (resolved.executableTools.length > 0) {
    console.log(`  Executable Tools (${resolved.executableTools.length}):`);
    for (const binding of resolved.executableTools) {
      const ref = binding.ref;
      const label = ref.type === "extension" ? `${ref.type}:${ref.extension}` : ref.type;
      console.log(`    - ${ref.name} (${label})`);
    }
  }
  if (resolved.permissions && resolved.permissions.length > 0) {
    console.log(`  权限 (${resolved.permissions.length}):`);
    for (const p of resolved.permissions) console.log(`    - ${p.capability}${p.scope ? ` (scope: ${JSON.stringify(p.scope)})` : ""}`);
  }
  if (resolved.diagnostics.length > 0) {
    console.log(`  Diagnostics (${resolved.diagnostics.length}):`);
    for (const diagnostic of resolved.diagnostics) {
      console.log(`    - [${diagnostic.severity}/${diagnostic.phase}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
}

/**
 * 启动指定 ID 的独立智能体原生运行界面，不自动发送首条消息。
 * 如需单轮执行并显式传入输入，请使用 agent once。
 * 退出码：0 正常，1 参数错误、智能体不存在或运行面不兼容。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，含 --config/--model/--debug
 */
async function agentRun(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent run <id> [--config <path>] [--model <model>] [--debug]");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);
  const modelOverrideIndex = rest.indexOf("--model");
  const modelOverride = resolveCliModelOverride(
    modelOverrideIndex >= 0 && modelOverrideIndex + 1 < rest.length ? rest[modelOverrideIndex + 1] : undefined,
  );
  const debug = rest.includes("--debug");

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  const config = loadWorkflowConfig(configPath);
  const registry = createRegistryFromConfig(config);

  if (!registry.has(agentId)) {
    logger.error(`智能体 "${agentId}" 未找到`);
    process.exit(1);
  }

  const unexpectedArgument = findUnexpectedPositionalArg(rest, ["--config", "--model", "--debug"]);
  if (unexpectedArgument) {
    logger.error(`agent run 不接受位置输入参数: ${unexpectedArgument}`);
    logger.error("如需显式输入，请使用: pi-workflow agent once <id> --input <path>");
    process.exit(1);
  }

  const dummyNode: WorkflowNodeIR = {
    id: "_agent_run",
    title: "_agent_run",
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    executor: { type: "agent", config: { agentId } },
  };
  const resolved = resolveAgentConfig(dummyNode, config, registry);

  if (debug) {
    logger.debug(`运行智能体: ${agentId}`);
    logger.debug(`模型覆盖: ${modelOverride ?? "无"}`);
  }

  if (resolved.runtimeMode !== "pi-tui") {
    logger.error(`智能体 "${agentId}" 的运行面为 "${resolved.runtimeMode}"，请使用 agent once 单轮执行`);
    process.exit(1);
  }

  const { runResolvedAssemblyInPiTui } = await import("@pi-workflow/core");
  await runResolvedAssemblyInPiTui({
    assembly: {
      ...resolved,
      model: modelOverride
        ? {
            id: modelOverride,
            provider: modelOverride.split("/")[0],
            name: modelOverride.split("/")[1],
            temperature: resolved.model?.temperature,
            maxTokens: resolved.model?.maxTokens,
          }
        : resolved.model,
    },
    config,
  });
}

/**
 * 以显式输入单轮执行指定智能体。
 * 仅执行一次模型调用，适合脚本、批处理与快速验证。
 * 退出码：0 正常，1 参数错误、智能体不存在或执行失败。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，含 --config/--input/--prompt/--model/--debug
 */
async function agentOnce(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent once <id> [--config <path>] [--input <path> | --prompt <text>] [--model <model>] [--debug]");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);
  const modelOverrideIndex = rest.indexOf("--model");
  const modelOverride = resolveCliModelOverride(
    modelOverrideIndex >= 0 && modelOverrideIndex + 1 < rest.length ? rest[modelOverrideIndex + 1] : undefined,
  );
  const inputPath = extractOptionValue(rest, "--input");
  const promptOverride = extractOptionValue(rest, "--prompt");
  const debug = rest.includes("--debug");

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  const config = loadWorkflowConfig(configPath);
  const registry = createRegistryFromConfig(config);

  if (!registry.has(agentId)) {
    logger.error(`智能体 "${agentId}" 未找到`);
    process.exit(1);
  }

  if (promptOverride && inputPath) {
    logger.error("错误: --prompt 与 --input 不能同时指定");
    process.exit(1);
  }

  const input = inputPath ? loadInputFile(inputPath) : {};
  const prompt = promptOverride ?? resolvePromptFromInput(input);
  if (!prompt) {
    logger.error("错误: agent once 需要通过 --prompt 或 --input 提供显式输入");
    process.exit(1);
  }

  if (debug) {
    debugLog(debug, `配置文件: ${configPath}`);
    debugLog(debug, `运行智能体: ${agentId}`);
    debugLog(debug, `模型覆盖: ${modelOverride ?? "无"}`);
    debugLog(debug, `输入文件: ${inputPath ?? "无"}`);
    debugLog(debug, `prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""}`);
  }

  const dummyNode: WorkflowNodeIR = {
    id: "_agent_once",
    title: "_agent_once",
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    executor: { type: "agent", config: { agentId } },
  };
  const resolved = resolveAgentConfig(dummyNode, config, registry);

  const { PiHostAdapter } = await import("@pi-workflow/core");
  const { registerBuiltinTools } = await import("@pi-workflow/builtin-tools");
  const host = new PiHostAdapter({
    builtinTools: registerBuiltinTools(),
    permissionCheck: (capability, resource) => checkAgentPermission(config, capability, resource),
  });
  const invoker = new CustomAgentInvoker({ host, registry, config });
  let content = "";
  const gen = invoker.invoke({
    agentId,
    prompt,
    input,
    model: modelOverride,
    resolvedAssembly: resolved,
  });

  for await (const event of gen) {
    switch (event.type) {
      case "agent.text_delta":
        content += event.delta;
        process.stdout.write(event.delta);
        break;
      case "agent.tool_start":
        if (debug) logger.debug(`工具调用: ${event.toolName}`);
        break;
      case "agent.tool_end":
        if (debug) logger.debug(`工具完成: ${event.toolName}`);
        break;
      case "agent.skill_start":
        if (debug) logger.debug(`Skill: ${event.skillName}`);
        break;
      case "agent.skill_end":
        if (debug) logger.debug(`Skill 完成: ${event.skillName}`);
        break;
      case "agent.error":
        logger.error(`执行错误: ${event.error}`);
        process.exit(1);
        break;
    }
  }

  if (debug) {
    console.error(`\n\n最终输出 (${content.length} chars):`);
    console.error(JSON.stringify({ agentId, contentLength: content.length }, null, 2));
  }
  console.log("");
}

/**
 * 加载工作流配置文件，解析失败时打印错误并以退出码 1 终止进程。
 *
 * @param configPath 配置文件路径
 * @returns 解析后的 WorkflowConfig 对象
 */
function loadWorkflowConfig(configPath: string): WorkflowConfig {
  try {
    const loaded = loadWorkflowConfigFile(configPath);
    return {
      ...loaded.config,
      baseDir: loaded.baseDir,
    };
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/**
 * 从参数数组中提取 --config 选项的值。
 *
 * @param args 命令行参数数组
 * @returns --config 后面的路径，未指定时返回 undefined
 */
function extractConfigPath(args: string[]): string | undefined {
  return extractOptionValue(args, "--config");
}

function extractOptionValue(args: string[], optionName: string): string | undefined {
  const idx = args.indexOf(optionName);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function findUnexpectedPositionalArg(args: string[], knownOptions: readonly string[]): string | undefined {
  const optionsWithValue = new Set(["--config", "--model", "--input", "--prompt"]);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      if (optionsWithValue.has(arg)) {
        i += 1;
      }
      continue;
    }
    if (!knownOptions.includes(arg)) {
      return arg;
    }
  }
  return undefined;
}

function loadInputFile(inputPath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(inputPath, "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("input 必须是 JSON 对象");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`无法读取输入文件: ${inputPath} (${reason})`);
    process.exit(1);
  }
}

function checkAgentPermission(
  config: WorkflowConfig | undefined,
  capability: string,
  resource?: string,
): { allowed: boolean; reason?: string } {
  const { evaluateCapability } = requireCoreSecurity();
  const result = evaluateCapability(
    config?.security,
    capability as never,
    resource ? { resource } : undefined,
  );
  return { allowed: result.allowed, reason: result.reason };
}

function requireCoreSecurity(): {
  evaluateCapability: (
    config: WorkflowConfig["security"] | undefined,
    capability: never,
    context?: { resource?: string },
  ) => { allowed: boolean; reason?: string };
} {
  // 复用 run 命令同一套权限判定逻辑，避免 once 路径绕过 fs.read/fs.write 检查。
  return require("@pi-workflow/core") as {
    evaluateCapability: (
      config: WorkflowConfig["security"] | undefined,
      capability: never,
      context?: { resource?: string },
    ) => { allowed: boolean; reason?: string };
  };
}

function resolvePromptFromInput(input: Record<string, unknown>): string | undefined {
  return typeof input["prompt"] === "string"
    ? input["prompt"] as string
    : typeof input["user_prompt"] === "string"
      ? input["user_prompt"] as string
      : typeof input["userPrompt"] === "string"
        ? input["userPrompt"] as string
        : undefined;
}

function describeToolRef(tool: { type?: string; extension?: string; source?: string }): string {
  if (tool.type === "extension") {
    return `${tool.type}:${tool.extension ?? "unknown"}`;
  }
  if (tool.type) {
    return tool.type;
  }
  return tool.source ?? "legacy";
}
