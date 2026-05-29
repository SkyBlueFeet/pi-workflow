import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createRegistryFromConfig, loadWorkflowConfigFile, CustomAgentInvoker, resolveAgentConfig } from "@pi-workflow/core";
import type { WorkflowConfig, WorkflowNodeIR } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

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
    case "chat":
      await agentChat(args.slice(1));
      break;
    default:
      console.log("pi-workflow agent - 智能体管理");
      console.log("");
      console.log("用法:");
      console.log("  pi-workflow agent list [--config <path>]           列出所有智能体");
      console.log("  pi-workflow agent show <id> [--config <path>]     查看智能体详情");
      console.log("  pi-workflow agent resolve <id> [--config <path>]  查看合并后的智能体配置");
      console.log("  pi-workflow agent run <id> [input.json] [--config <path>] [--model <model>] [--debug]  运行独立智能体");
      console.log("  pi-workflow agent chat <id> [--config <path>] [--model <model>] [--debug]              交互式对话");
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
    console.log(`    workflow tools: ${Object.keys(agent.workflowTools ?? {}).length}`);
    console.log(`    mcp servers: ${agent.mcp?.length ?? 0}`);
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
  if (agent.temperature !== undefined) console.log(`  温度: ${agent.temperature}`);
  if (agent.maxTokens !== undefined) console.log(`  最大 Token: ${agent.maxTokens}`);
  if (agent.skills && agent.skills.length > 0) {
    console.log(`  Skills:`);
    for (const s of agent.skills) console.log(`    - ${s.name}${s.source ? ` (${s.source})` : ""}`);
  }
  if (agent.tools && agent.tools.length > 0) {
    console.log(`  Tools:`);
    for (const t of agent.tools) console.log(`    - ${t.name}${t.source ? ` (${t.source})` : ""}`);
  }
  if (agent.workflowTools && Object.keys(agent.workflowTools).length > 0) {
    console.log(`  Workflow Tools:`);
    for (const [name, wt] of Object.entries(agent.workflowTools)) {
      console.log(`    - ${name}${wt.description ? `: ${wt.description}` : ""}`);
      if (wt.workflowPath) console.log(`      路径: ${wt.workflowPath}`);
    }
  }
  if (agent.mcp && agent.mcp.length > 0) {
    console.log(`  MCP:`);
    for (const m of agent.mcp) console.log(`    - ${m.server}`);
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
  console.log(`  系统提示: ${resolved.systemPrompt.slice(0, 120)}${resolved.systemPrompt.length > 120 ? "..." : ""}`);
  if (resolved.userPrompt) console.log(`  用户提示: ${resolved.userPrompt.slice(0, 120)}${resolved.userPrompt.length > 120 ? "..." : ""}`);
  console.log(`  模型: ${resolved.model ? `${resolved.model.provider ?? "?"}/${resolved.model.model ?? "?"}` : "未配置"}`);
  if (resolved.temperature !== undefined) console.log(`  温度: ${resolved.temperature}`);
  if (resolved.maxTokens !== undefined) console.log(`  最大 Token: ${resolved.maxTokens}`);
  if (resolved.skills && resolved.skills.length > 0) {
    console.log(`  Skills (${resolved.skills.length}):`);
    for (const s of resolved.skills) console.log(`    - ${s.name}${s.source ? ` (${s.source})` : ""}`);
  }
  if (resolved.tools && resolved.tools.length > 0) {
    console.log(`  Tools (${resolved.tools.length}):`);
    for (const t of resolved.tools) console.log(`    - ${t.name}${t.source ? ` (${t.source})` : ""}`);
  }
  if (resolved.workflowTools && Object.keys(resolved.workflowTools).length > 0) {
    console.log(`  Workflow Tools (${Object.keys(resolved.workflowTools).length}):`);
    for (const [name, wt] of Object.entries(resolved.workflowTools)) {
      console.log(`    - ${name}${wt.description ? `: ${wt.description}` : ""}`);
      if (wt.workflowPath) console.log(`      路径: ${wt.workflowPath}`);
      if (wt.workflow) console.log(`      类型: 内联 IR (${wt.workflow.id})`);
    }
  }
  if (resolved.mcp && resolved.mcp.length > 0) {
    console.log(`  MCP (${resolved.mcp.length}):`);
    for (const m of resolved.mcp) console.log(`    - ${m.server}`);
  }
  if (resolved.permissions && resolved.permissions.length > 0) {
    console.log(`  权限 (${resolved.permissions.length}):`);
    for (const p of resolved.permissions) console.log(`    - ${p.capability}${p.scope ? ` (scope: ${JSON.stringify(p.scope)})` : ""}`);
  }
}

/**
 * 运行指定 ID 的独立智能体，不依赖 workflow 节点。
 * 实时流式输出 delta，完成后打印最终结果 JSON。
 * 退出码：0 正常，1 参数错误、智能体不存在或执行失败。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，后跟可选 input.json，以及 --config/--model/--debug
 */
async function agentRun(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent run <id> [input.json] [--config <path>] [--model <model>] [--debug]");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);
  const modelOverrideIndex = rest.indexOf("--model");
  const modelOverride = modelOverrideIndex >= 0 && modelOverrideIndex + 1 < rest.length ? rest[modelOverrideIndex + 1] : undefined;
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

  const optionIndices = new Set<number>();
  const configIdxInRest = rest.indexOf("--config");
  if (configIdxInRest >= 0) {
    optionIndices.add(configIdxInRest);
    if (configIdxInRest + 1 < rest.length) optionIndices.add(configIdxInRest + 1);
  }
  if (modelOverrideIndex >= 0) {
    optionIndices.add(modelOverrideIndex);
    if (modelOverrideIndex + 1 < rest.length) optionIndices.add(modelOverrideIndex + 1);
  }
  const debugIdx = rest.indexOf("--debug");
  if (debugIdx >= 0) optionIndices.add(debugIdx);

  const restWithoutOptions = rest.filter((_a, i) => !optionIndices.has(i));
  const inputPath = restWithoutOptions.length > 0 ? restWithoutOptions[0] : undefined;

  let input: Record<string, unknown> = {};
  if (inputPath) {
    try {
      input = JSON.parse(readFileSync(inputPath, "utf-8"));
    } catch {
      logger.error(`无法读取输入文件: ${inputPath}`);
      process.exit(1);
    }
  }

  const prompt = (input["prompt"] as string)
    ?? (input["user_prompt"] as string)
    ?? (input["userPrompt"] as string)
    ?? JSON.stringify(input);

  const { PiHostAdapter } = await import("@pi-workflow/core");
  const host = new PiHostAdapter();

  const invoker = new CustomAgentInvoker({ host, registry, config });

  if (debug) {
    logger.debug(`运行智能体: ${agentId}`);
    logger.debug(`模型覆盖: ${modelOverride ?? "无"}`);
    logger.debug(`输入: ${JSON.stringify(input)}`);
  }

  let content = "";
  const gen = invoker.invoke({
    agentId,
    prompt,
    input,
    model: modelOverride,
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
 * 交互式对话模式，与指定智能体进行多轮对话。
 * 读入用户输入流式输出回复，输入 /exit 退出。
 * 退出码：0 正常，1 参数错误、智能体不存在。
 *
 * @param args 命令行参数，args[0] 为智能体 ID，含 --config/--model/--debug
 */
async function agentChat(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定智能体 ID");
    logger.error("用法: pi-workflow agent chat <id> [--config <path>] [--model <model>] [--debug]");
    process.exit(1);
  }

  const agentId = args[0];
  const rest = args.slice(1);
  const configPath = extractConfigPath(rest);
  const modelOverrideIndex = rest.indexOf("--model");
  const modelOverride = modelOverrideIndex >= 0 && modelOverrideIndex + 1 < rest.length ? rest[modelOverrideIndex + 1] : undefined;
  const debug = rest.includes("--debug");

  if (!configPath) {
    logger.error("错误: 请通过 --config <path> 指定配置文件");
    process.exit(1);
  }

  if (debug) debugLog(debug, `配置文件: ${configPath}`);

  const config = loadWorkflowConfig(configPath);
  if (debug) {
    debugLog(debug, `全局模型: ${config.model ? `${config.model.provider}/${config.model.model}` : "未设置"}`);
    debugLog(debug, `已定义智能体: ${config.agents ? Object.keys(config.agents).join(", ") : "无"}`);
  }

  const registry = createRegistryFromConfig(config);

  if (!registry.has(agentId)) {
    logger.error(`智能体 "${agentId}" 未找到`);
    process.exit(1);
  }

  const def = registry.get(agentId)!;
  if (debug) {
    debugLog(debug, `智能体 ${agentId}:`);
    if (def.name) debugLog(debug, `  名称: ${def.name}`);
    if (def.description) debugLog(debug, `  描述: ${def.description}`);
    if (def.systemPrompt) debugLog(debug, `  系统提示: ${def.systemPrompt.slice(0, 80)}...`);
    if (def.model) debugLog(debug, `  模型(智能体级): ${def.model.provider}/${def.model.model}`);
    if (def.skills?.length) debugLog(debug, `  skills: ${def.skills.map(s => s.name).join(", ")}`);
    if (def.tools?.length) debugLog(debug, `  tools: ${def.tools.map(t => t.name).join(", ")}`);
    if (def.mcp?.length) debugLog(debug, `  MCP: ${def.mcp.map(m => m.server).join(", ")}`);
  }

  const defModel = def.model
    ? `${def.model.provider ?? "?"}/${def.model.model ?? "?"}`
    : undefined;
  const globalModel = config.model
    ? `${config.model.provider ?? "?"}/${config.model.model ?? "?"}`
    : undefined;
  const actualModel = modelOverride ?? defModel ?? globalModel ?? "未指定";

  const { PiHostAdapter } = await import("@pi-workflow/core");
  const host = new PiHostAdapter();
  const invoker = new CustomAgentInvoker({ host, registry, config });

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const modelLabel = modelOverride
    ? `${actualModel} (CLI 指定)`
    : defModel
      ? `${actualModel} (智能体配置)`
      : globalModel
        ? `${actualModel} (全局配置)`
        : actualModel;

  if (debug) {
    debugLog(debug, `模型覆盖(--model): ${modelOverride ?? "无"}`);
    debugLog(debug, `智能体级模型: ${defModel ?? "无"}`);
    debugLog(debug, `全局配置模型: ${globalModel ?? "无"}`);
    debugLog(debug, `实际使用模型: ${actualModel}`);
  }

  console.log(`\n${def.name ?? agentId}  模型: ${modelLabel}`);
  console.log("输入 /exit 退出，直接输入开始对话\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n> ",
  });

  const askQuestion = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question("> ", (answer) => resolve(answer.trim()));
    });

  try {
    while (true) {
      const userInput = await askQuestion();
      if (!userInput) continue;
      if (userInput === "/exit") break;

      history.push({ role: "user", content: userInput });

      if (debug) {
        const msgCount = history.filter(h => h.role === "user").length;
        debugLog(debug, `--- 第 ${msgCount} 轮 ---`);
        debugLog(debug, `发送提示词: ${userInput.slice(0, 100)}${userInput.length > 100 ? "..." : ""}`);
      }

      const gen = invoker.invoke({
        agentId,
        prompt: userInput,
        model: modelOverride,
        initialMessages: history.slice(0, -1).map(h => ({
          role: h.role,
          content: [{ type: "text" as const, text: h.content }],
        })),
      });

      let content = "";
      let firstDelta = true;
      let deltaCount = 0;
      for await (const event of gen) {
        switch (event.type) {
          case "agent.text_delta":
            if (debug && firstDelta) {
              debugLog(debug, "模型开始回复");
              firstDelta = false;
            }
            content += event.delta;
            deltaCount++;
            process.stdout.write(event.delta);
            break;
          case "agent.tool_start":
            if (debug) debugLog(debug, `工具调用: ${event.toolName}`);
            break;
          case "agent.tool_end":
            if (debug) debugLog(debug, `工具完成: ${event.toolName}`);
            break;
          case "agent.skill_start":
            if (debug) debugLog(debug, `Skill 开始: ${event.skillName}`);
            break;
          case "agent.skill_end":
            if (debug) debugLog(debug, `Skill 结束: ${event.skillName}`);
            break;
          case "agent.mcp_start":
            if (debug) debugLog(debug, `MCP 开始: ${event.serverName}`);
            break;
          case "agent.mcp_end":
            if (debug) debugLog(debug, `MCP 结束: ${event.serverName}`);
            break;
          case "agent.error":
            console.log("");
            logger.error(`错误: ${event.error}`);
            content = "";
            break;
        }
      }

      if (content) {
        console.log("");
        if (debug) debugLog(debug, `回复完成 (${content.length} 字符, ${deltaCount} 个增量)`);
        history.push({ role: "assistant", content });
      }
    }
  } finally {
    rl.close();
    console.log("\n对话结束。");
  }
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
  const idx = args.indexOf("--config");
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}
