/**
 * 控制台渲染器。
 *
 * 职责：
 * 1. 将 ConsoleView 与状态 payload 渲染为终端文本
 * 2. 输出视图标题、数据、错误、提示符
 * 3. 不包含任何业务逻辑，只做格式化输出
 */

import type { StudioConsoleState, ConsoleView } from "./studio-state.js";

/** ANSI 转义序列常量。 */
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";
const CYAN = "\u001b[36m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const RED = "\u001b[31m";

/** 视图标题映射。 */
const VIEW_TITLES: Record<ConsoleView, string> = {
  home: "pi-studio 控制台",
  workflows: "Workflows",
  agents: "Agents",
  skills: "Skills",
  tools: "Tools",
  resources: "Resources",
  runs: "Runs",
  "create-workflow": "创建 Workflow",
  "create-agent": "创建 Agent",
  help: "帮助",
};

/** 视图副标题映射。 */
const VIEW_SUBTITLES: Partial<Record<ConsoleView, string>> = {
  home: "输入 /help 查看可用命令",
  workflows: "已注册的工作流列表",
  agents: "已注册的智能体列表",
  skills: "可用的 Skill 列表",
  tools: "可用的 Tool 列表",
  resources: "可用的 Resource 列表",
  runs: "最近的运行记录",
  "create-workflow": "通过 AI 助手生成 Workflow 草稿",
  "create-agent": "通过 AI 助手生成 Agent 草稿",
};

/**
 * 渲染控制台当前视图。
 * 返回终端文本，由 shell 主循环负责输出。
 */
export function renderView(state: StudioConsoleState): string {
  const lines: string[] = [];

  // 分割线
  lines.push(`${DIM}${"=".repeat(60)}${RESET}`);

  // 标题
  const title = VIEW_TITLES[state.view] ?? state.view;
  lines.push(`${BOLD}${CYAN}  ${title}${RESET}`);
  const subtitle = VIEW_SUBTITLES[state.view];
  if (subtitle) {
    lines.push(`  ${DIM}${subtitle}${RESET}`);
  }

  // 错误
  if (state.lastError) {
    lines.push("");
    lines.push(`  ${RED}[错误] ${state.lastError}${RESET}`);
  }

  // 负载渲染
  if (state.payload !== null && state.payload !== undefined) {
    lines.push("");
    lines.push(renderPayload(state.payload));
  }

  // loading
  if (state.loading) {
    lines.push("");
    lines.push(`  ${YELLOW}处理中...${RESET}`);
  }

  lines.push("");
  lines.push(`${DIM}${"=".repeat(60)}${RESET}`);

  return lines.join("\n");
}

/** 渲染荷载数据为终端文本。 */
function renderPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return `  ${payload}`;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return `  ${DIM}(空)${RESET}`;
    }
    return payload
      .map((item, idx) => {
        if (typeof item === "string") {
          return `  ${idx + 1}. ${item}`;
        }
        if (item && typeof item === "object") {
          const name =
            (item as Record<string, unknown>).name ??
            (item as Record<string, unknown>).id ??
            "—";
          const desc =
            (item as Record<string, unknown>).description ?? "";
          return `  ${idx + 1}. ${BOLD}${String(name)}${RESET}${desc ? ` — ${DIM}${String(desc).slice(0, 60)}${RESET}` : ""}`;
        }
        return `  ${idx + 1}. ${String(item)}`;
      })
      .join("\n");
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>)
      .map(([k, v]) => `  ${GREEN}${k}${RESET}: ${String(v)}`)
      .join("\n");
  }

  return `  ${String(payload)}`;
}

/** 渲染输入提示符。 */
export function renderPrompt(state: StudioConsoleState): string {
  const modeLabel = state.inputMode === "assistant" ? "AI" : ">";
  const viewLabel = state.view !== "home" ? ` [${state.view}]` : "";
  return `\n${GREEN}pi-studio${RESET}${DIM}${viewLabel}${RESET} ${modeLabel} `;
}

/** 渲染一条系统消息（用于确认等场景）。 */
export function renderSystemMessage(text: string): string {
  return `\n${DIM}  ${text}${RESET}`;
}

/** 渲染帮助文本。 */
export function renderHelp(): string {
  const lines = [
    `${DIM}${"=".repeat(60)}${RESET}`,
    `${BOLD}${CYAN}  pi-studio 控制台 — 可用命令${RESET}`,
    "",
    `  ${BOLD}/help${RESET}             显示此帮助`,
    `  ${BOLD}/workflows${RESET}         浏览已注册的工作流`,
    `  ${BOLD}/agents${RESET}            浏览已注册的智能体`,
    `  ${BOLD}/skills${RESET}            浏览可用的 Skill`,
    `  ${BOLD}/tools${RESET}             浏览可用的 Tool`,
    `  ${BOLD}/resources${RESET}         浏览可用的 Resource`,
    `  ${BOLD}/runs${RESET}              浏览最近的运行记录`,
    `  ${BOLD}/create-workflow${RESET}   创建新的 Workflow`,
    `  ${BOLD}/create-agent${RESET}      创建新的 Agent`,
    "",
    `  ${BOLD}exit${RESET}               退出控制台`,
    "",
    `  ${DIM}直接输入自然语言将由 AI 助手处理${RESET}`,
    `${DIM}${"=".repeat(60)}${RESET}`,
  ];
  return lines.join("\n");
}
