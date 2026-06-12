/**
 * 控制台命令路由器。
 *
 * 职责：
 * 1. 解析用户输入：区分 slash command 与自然语言
 * 2. 将 slash command 路由到对应的处理函数
 * 3. 将自然语言输入路由到 AI 助手
 */

import type { StudioConsoleState } from "./studio-state.js";

/** 控制台中注册的 slash command 名称。 */
export const STUDIO_COMMANDS = [
  "/help",
  "/workflows",
  "/agents",
  "/skills",
  "/tools",
  "/resources",
  "/runs",
  "/create-workflow",
  "/create-agent",
] as const;

export type StudioCommand = (typeof STUDIO_COMMANDS)[number];

/** 命令处理结果。 */
export interface CommandResult {
  /** 新的控制台状态 */
  state: StudioConsoleState;
  /** 可选的系统响应文本 */
  output?: string;
}

/** slash command 处理器函数类型。 */
export type CommandHandler = (
  state: StudioConsoleState,
  args: string[],
) => CommandResult | Promise<CommandResult>;

/** 命令路由表。 */
export type CommandRouter = Map<StudioCommand, CommandHandler>;

/**
 * 解析原始输入，返回是否为 slash command 及其名称和参数。
 */
export function parseInput(
  input: string,
): { isCommand: true; command: string; args: string[] } | { isCommand: false; text: string } {
  const trimmed = input.trim();

  if (trimmed.startsWith("/")) {
    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return { isCommand: true, command, args };
  }

  return { isCommand: false, text: trimmed };
}

/**
 * 判断给定的字符串是否为已知的 studio command。
 */
export function isStudioCommand(command: string): command is StudioCommand {
  return (STUDIO_COMMANDS as readonly string[]).includes(command);
}

/**
 * 创建默认的命令路由表。
 * 每个命令绑定到对应的处理函数（骨架实现）。
 */
export function createDefaultRouter(): CommandRouter {
  const router: CommandRouter = new Map();

  router.set("/help", handleHelp);
  router.set("/workflows", handleWorkflows);
  router.set("/agents", handleAgents);
  router.set("/skills", handleSkills);
  router.set("/tools", handleTools);
  router.set("/resources", handleResources);
  router.set("/runs", handleRuns);
  router.set("/create-workflow", handleCreateWorkflow);
  router.set("/create-agent", handleCreateAgent);

  return router;
}

// ─── 命令处理函数（骨架实现）──────────────────────────────

import {
  navigateTo,
  setPayload,
  setLoading,
  addMessage,
} from "./studio-state.js";

function handleHelp(state: StudioConsoleState): CommandResult {
  const next = navigateTo(state, "help");
  return {
    state: next,
  };
}

function handleWorkflows(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "workflows"), true);
  // 骨架：暂不接入真实 catalog 服务
  const placeholderData = [
    { id: "example-workflow-1", description: "示例工作流（占位）" },
  ];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "已加载 workflows 列表（骨架数据）",
  };
}

function handleAgents(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "agents"), true);
  const placeholderData = [
    { id: "example-agent-1", description: "示例智能体（占位）" },
  ];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "已加载 agents 列表（骨架数据）",
  };
}

function handleSkills(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "skills"), true);
  const placeholderData: string[] = [];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "skills 目录功能预留，后续接入真实数据源",
  };
}

function handleTools(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "tools"), true);
  const placeholderData: string[] = [];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "tools 目录功能预留，后续接入真实数据源",
  };
}

function handleResources(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "resources"), true);
  const placeholderData: string[] = [];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "resources 目录功能预留，后续接入真实数据源",
  };
}

function handleRuns(state: StudioConsoleState): CommandResult {
  const next = setLoading(navigateTo(state, "runs"), true);
  const placeholderData: string[] = [];
  const resolved = setPayload(setLoading(next, false), placeholderData);
  return {
    state: resolved,
    output: "runs 目录功能预留，后续接入真实数据源",
  };
}

function handleCreateWorkflow(state: StudioConsoleState): CommandResult {
  const next = navigateTo(state, "create-workflow");
  return {
    state: addMessage(
      addMessage(
        next,
        {
          role: "user",
          content: "/create-workflow",
          timestamp: new Date(),
        },
      ),
      {
        role: "system",
        content:
          "创建 Workflow 命令已触发（骨架）。后续将接入 WorkflowAuthoringService 生成草稿。",
        timestamp: new Date(),
      },
    ),
    output:
      "请输入 Workflow 描述（自然语言），或按 Ctrl+C 返回。此功能后续将接入 AI 生成链路。",
  };
}

function handleCreateAgent(state: StudioConsoleState): CommandResult {
  const next = navigateTo(state, "create-agent");
  return {
    state: addMessage(
      addMessage(
        next,
        {
          role: "user",
          content: "/create-agent",
          timestamp: new Date(),
        },
      ),
      {
        role: "system",
        content:
          "创建 Agent 命令已触发（骨架）。后续将接入 AgentAuthoringService 生成草稿。",
        timestamp: new Date(),
      },
    ),
    output:
      "请输入 Agent 描述（自然语言），或按 Ctrl+C 返回。此功能后续将接入 AI 生成链路。",
  };
}
