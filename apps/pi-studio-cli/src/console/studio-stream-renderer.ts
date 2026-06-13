/**
 * 控制台流式渲染器 — 将 PI agent runtime 事件渲染为控制台输出。
 *
 * 对标 pi-workflow agent once 的流式输出模式 + PI WorkflowProgressRenderer 的视觉风格。
 *
 * 输出示例：
 *   [AI] ▶ 开始处理...
 *   [AI] 这是模型生成的文本...           ← agent.text_delta 流式输出
 *   [TOOL] ↳ 调用工具: read_file
 *   [OUT] file contents...
 *   [TOOL] ✓ 工具完成: read_file
 *   [AI] 继续生成...
 *   [AI] ✓ 处理完成
 */

import type { WorkflowHostEvent } from "@pi-workflow/core";
import pc from "picocolors";

// ─── 公共渲染函数 ─────────────────────────────────

/** 流式输出单个 token（无换行）。 */
export function renderToken(delta: string): string {
  return delta;
}

/** 工具调用开始。 */
export function renderToolStart(toolName: string): string {
  return `\n${pc.yellow("[TOOL]")} ${pc.yellow("↳")} 调用工具: ${toolName}`;
}

/** 工具调用结束。 */
export function renderToolEnd(toolName: string): string {
  return `${pc.green("[TOOL]")} ${pc.green("✓")} 工具完成: ${toolName}`;
}

/** skill 开始。 */
export function renderSkillStart(skillName: string): string {
  return `${pc.magenta("[SKILL]")} ${pc.magenta("▶")} ${skillName}`;
}

/** skill 结束。 */
export function renderSkillEnd(skillName: string): string {
  return `${pc.magenta("[SKILL]")} ${pc.magenta("✓")} ${skillName}`;
}

/** MCP 服务调用开始。 */
export function renderMcpStart(serverName: string): string {
  return `${pc.cyan("[MCP]")} ${pc.cyan("↳")} ${serverName}`;
}

/** MCP 服务调用结束。 */
export function renderMcpEnd(serverName: string): string {
  return `${pc.cyan("[MCP]")} ${pc.cyan("✓")} ${serverName}`;
}

/** 错误。 */
export function renderError(error: string): string {
  return `\n${pc.red("[AI]")} ${pc.red("✗")} ${error}`;
}

/** 思维链开始。 */
export function renderThinkingStart(): string {
  return `\n${pc.dim("[THINK]")} 思考中...`;
}

/** 思维链 delta（流式输出）。 */
export function renderThinkingDelta(delta: string): string {
  return delta;
}

/** 思维链结束。 */
export function renderThinkingEnd(): string {
  return `\n${pc.dim("[THINK]")} 思考完成`;
}

/** 工具部分更新。 */
export function renderToolUpdate(toolName: string): string {
  return `${pc.yellow("[TOOL]")} ${pc.yellow("…")} 更新: ${toolName}`;
}

/** 未映射事件（调试用）。 */
export function renderUnmapped(eventType: string): string {
  return `\n${pc.dim("[EVENT]")} ${pc.dim("·")} ${eventType}`;
}

/** AI 模式启动提示。 */
export function renderAiStart(): string {
  return `\n${pc.magenta("[AI]")} ${pc.magenta("▶")} 正在处理...`;
}

/** AI 模式结束。 */
export function renderAiEnd(): string {
  return `\n${pc.green("[AI]")} ${pc.green("✓")} 处理完成`;
}

/** AI 模式提示（无模型时）。 */
export function renderAiUnavailable(): string {
  return `\n${pc.dim("[AI]")} AI 助手不可用：请先配置模型。`;
}

// ─── 未映射事件分派 ─────────────────────────────────

/**
 * 处理 agent.unmapped 事件，根据 eventType 分派到对应渲染函数。
 * 当前支持：thinking_delta（流式输出）、thinking_start、thinking_end、tool_execution_update。
 */
function renderUnmappedEvent(
  eventType: string,
  payload: Record<string, unknown> | undefined,
  currentContent: string,
): StreamRenderResult {
  switch (eventType) {
    case "thinking_start":
      console.log(renderThinkingStart());
      return { content: currentContent };
    case "thinking_delta":
      if (payload?.["delta"]) {
        const delta = String(payload["delta"]);
        process.stdout.write(renderThinkingDelta(delta));
        return { content: currentContent };
      }
      return { content: currentContent };
    case "thinking_end":
      console.log(renderThinkingEnd());
      return { content: currentContent };
    case "tool_execution_update":
      console.log(renderToolUpdate(String(payload?.["toolName"] ?? "")));
      return { content: currentContent };
    default:
      // 未知事件类型：静默输出调试信息
      console.log(renderUnmapped(eventType));
      return { content: currentContent };
  }
}

/** 流式事件渲染结果。 */
export interface StreamRenderResult {
  /** 累积的完整文本 */
  content: string;
}

/**
 * 流式处理单个 PI agent runtime 事件，直接写入 stdout。
 * 对标 pi-workflow agent once 的 for-await 消费模式。
 *
 * @returns 当前累积的完整文本内容
 */
export function renderStreamEvent(
  event: WorkflowHostEvent,
  currentContent: string,
): StreamRenderResult {
  switch (event.type) {
    case "agent.text_delta":
      process.stdout.write(event.delta);
      return { content: currentContent + event.delta };

    case "agent.tool_start":
      console.log(renderToolStart(event.toolName));
      return { content: currentContent };

    case "agent.tool_end":
      console.log(renderToolEnd(event.toolName));
      return { content: currentContent };

    case "agent.skill_start":
      console.log(renderSkillStart(event.skillName));
      return { content: currentContent };

    case "agent.skill_end":
      console.log(renderSkillEnd(event.skillName));
      return { content: currentContent };

    case "agent.mcp_start":
      console.log(renderMcpStart(event.serverName));
      return { content: currentContent };

    case "agent.mcp_end":
      console.log(renderMcpEnd(event.serverName));
      return { content: currentContent };

    case "agent.unmapped":
      return renderUnmappedEvent(event.eventType, event.payload, currentContent);

    case "agent.error":
      console.log(renderError(event.error));
      return { content: currentContent };

    default:
      return { content: currentContent };
  }
}
