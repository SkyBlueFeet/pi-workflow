/**
 * 控制台渲染器 — 对齐 PI 体系视觉风格。
 *
 * PI 显示风格：结构化彩色日志流，使用 [TAG] 前缀 + ANSI 色码。
 *   [WF]  cyan    工作流状态
 *   [NODE] blue   ▶ 开始 / ✓ 完成 / ✗ 失败
 *   [TOOL] yellow  ↳ 调用 / ✓ 完成
 *   [ASK]  yellow  ? 询问
 *   [OUT]  dim     输出内容
 *
 * 本模块为 pi-studio 控制台引入：
 *   [studio]  cyan    宿主操作
 *   [catalog] blue    目录浏览
 *   [create]  yellow  创作流程
 *   [AI]      magenta AI 助手
 */

import type { StudioConsoleState, ConsoleView } from "./studio-state.js";
import pc from "picocolors";
import Table from "cli-table3";

/** 视图 → PI 风格 tag 映射。 */
const VIEW_TAGS: Record<ConsoleView, { tag: string; color: (s: string) => string; label: string }> = {
  home:        { tag: "studio",  color: pc.cyan,    label: "pi-studio 控制台" },
  workflows:   { tag: "catalog", color: pc.blue,    label: "Workflows" },
  agents:      { tag: "catalog", color: pc.blue,    label: "Agents" },
  skills:      { tag: "catalog", color: pc.blue,    label: "Skills" },
  tools:       { tag: "catalog", color: pc.blue,    label: "Tools" },
  resources:   { tag: "catalog", color: pc.blue,    label: "Resources" },
  runs:        { tag: "catalog", color: pc.blue,    label: "Runs" },
  "create-workflow": { tag: "create", color: pc.yellow, label: "创建 Workflow" },
  "create-agent":    { tag: "create", color: pc.yellow, label: "创建 Agent" },
  help:        { tag: "help",    color: pc.cyan,    label: "帮助" },
};

/** 渲染控制台当前视图。PI 风格：单行 [TAG] 标题 + 缩进内容。 */
export function renderView(state: StudioConsoleState): string {
  const lines: string[] = [];
  const meta = VIEW_TAGS[state.view] ?? { tag: "studio", color: pc.cyan, label: state.view };

  // 标题行: [TAG] ▶ label
  lines.push(`${tag(meta.tag, meta.color)} ${meta.color("▶")} ${meta.label}`);

  // 错误
  if (state.lastError) {
    lines.push(`${pc.red("[studio]")} ${pc.red("✗")} ${state.lastError}`);
  }

  // payload（loading 指示由 ora spinner 负责，此处不再渲染 loading 行）
  if (state.payload !== null && state.payload !== undefined) {
    lines.push(renderPayload(state.payload));
  }

  return lines.join("\n");
}

/** 渲染荷载数据。对象数组使用表格，其他保持缩进文本。 */
function renderPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return `  ${payload}`;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return `  ${pc.dim("(空)")}`;
    }
    // 对象数组 → 表格渲染
    if (payload[0] && typeof payload[0] === "object" && !Array.isArray(payload[0])) {
      return renderTable(payload as Record<string, unknown>[]);
    }
    // 字符串/混合数组 → 列表渲染
    return payload
      .map((item, idx) => {
        if (typeof item === "string") {
          return `  ${pc.dim(`${idx + 1}.`)} ${item}`;
        }
        if (item && typeof item === "object") {
          const name =
            (item as Record<string, unknown>).name ??
            (item as Record<string, unknown>).id ??
            "—";
          const desc =
            (item as Record<string, unknown>).description ?? "";
          return `  ${pc.dim(`${idx + 1}.`)} ${pc.cyan(`[${name}]`)}${desc ? ` ${pc.dim(`— ${String(desc).slice(0, 60)}`)}` : ""}`;
        }
        return `  ${pc.dim(`${idx + 1}.`)} ${String(item)}`;
      })
      .join("\n");
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>)
      .map(([k, v]) => `  ${pc.dim(`${k}:`)} ${String(v)}`)
      .join("\n");
  }

  return `  ${String(payload)}`;
}

/** 将对象数组渲染为终端表格。 */
function renderTable(items: Record<string, unknown>[]): string {
  const table = new Table({
    head: ["#", "名称", "描述"].map(h => pc.cyan(h)),
    style: { head: [], border: [] },
    colWidths: [4, 30, 55],
    wordWrap: true,
  });

  for (const [idx, item] of items.entries()) {
    const name = String(item.name ?? item.id ?? "—");
    const desc = String(item.description ?? "").slice(0, 100);
    table.push([idx + 1, name, desc || pc.dim("—")]);
  }

  return `\n${table.toString()}`;
}

/** 渲染输入提示符。PI 风格：绿色 tag + ▶ 符号。 */
export function renderPrompt(state: StudioConsoleState): string {
  const viewLabel = state.view !== "home" ? ` ${pc.dim(state.view)}` : "";
  const symbol = state.inputMode === "assistant" ? "?" : "▶";
  const fmt = state.inputMode === "assistant" ? pc.magenta : pc.green;
  return `\n${fmt(`[pi-studio${viewLabel}]`)} ${symbol} `;
}

/** 渲染系统消息。PI 风格：[studio] dim text。 */
export function renderSystemMessage(text: string): string {
  return `\n${pc.dim("[studio]")} ${text}`;
}

/** 渲染帮助文本。PI 风格：结构化 tags。 */
export function renderHelp(): string {
  const lines = [
    `${pc.cyan("[help]")} ${pc.cyan("▶")} pi-studio 控制台 — 可用命令`,
    "",
    `  ${pc.cyan("[/help]")}             ${pc.dim("显示此帮助")}`,
    `  ${pc.blue("[/workflows]")}         ${pc.dim("浏览已注册的工作流")}`,
    `  ${pc.blue("[/agents]")}            ${pc.dim("浏览已注册的智能体")}`,
    `  ${pc.blue("[/skills]")}            ${pc.dim("浏览可用的 Skill")}`,
    `  ${pc.blue("[/tools]")}             ${pc.dim("浏览可用的 Tool")}`,
    `  ${pc.blue("[/resources]")}         ${pc.dim("浏览可用的 Resource")}`,
    `  ${pc.blue("[/runs]")}              ${pc.dim("浏览最近的运行记录")}`,
    `  ${pc.yellow("[/create-workflow]")} ${pc.dim("创建新的 Workflow")}`,
    `  ${pc.yellow("[/create-agent]")}    ${pc.dim("创建新的 Agent")}`,
    "",
    `  ${pc.cyan("[/exit]")}  ${pc.dim("/quit")}        ${pc.dim("退出控制台")}`,
    "",
    `  ${pc.dim("直接输入自然语言将由 AI 助手处理")}`,
  ];
  return lines.join("\n");
}

/** PI 风格 tag 格式化：`[TEXT]` 包裹并着色。 */
function tag(text: string, formatter: (s: string) => string): string {
  return formatter(`[${text}]`);
}
