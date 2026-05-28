import { createRegistryFromConfig, resolveAgentConfig, loadWorkflowConfigFile } from "@pi-workflow/core";
import type { WorkflowConfig, WorkflowNodeIR } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

const logger = createLogger("agent");

/**
 * agent 命令入口，根据子命令路由到 list 或 show 处理函数。
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
    default:
      console.log("pi-workflow agent - 智能体管理");
      console.log("");
      console.log("用法:");
      console.log("  pi-workflow agent list [--config <path>]      列出所有智能体");
      console.log("  pi-workflow agent show <id> [--config <path>]  查看智能体详情");
      console.log("  pi-workflow agent resolve <id> [--config <path>]  查看合并后的智能体配置");
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
