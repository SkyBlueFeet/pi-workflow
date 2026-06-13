/**
 * PI 运行时桥接层。
 *
 * 职责：
 * 1. 将 studio-console 的 AI 助手请求转发给 PI agent runtime
 * 2. 将工作流/agent 执行请求通过 PI display shell 渲染
 * 3. 封装 PI runtime 的创建、调用、销毁生命周期
 */

import type { WorkflowConfig } from "@pi-workflow/core";
import pc from "picocolors";

// ─── AI 助手桥接 ────────────────────────────────────────

/**
 * 通过 PI agent runtime 执行一次自然语言查询。
 *
 * 骨架实现：目前使用 CustomAgentInvoker 做单轮调用（对齐 pi-workflow agent once）。
 * 后续阶段接入完整的 studio-console agent session。
 */
export async function invokePiAssistant(
  prompt: string,
  _config?: WorkflowConfig,
): Promise<string> {
  // 骨架：尝试使用 PI runtime，失败时回退到占位响应
  try {
    const { PiHostAdapter } = await import("@pi-workflow/core");
    const { registerBuiltinTools } = await import("@pi-workflow/builtin-tools");

    const host = new PiHostAdapter({
      builtinTools: registerBuiltinTools(),
      permissionCheck: () => ({ allowed: true }),
    });

    // TODO: 后续阶段使用真实的 studio-console agent assembly
    // 目前返回提示性响应
    const response = await generatePiAssistantResponse(prompt, host);
    return response;
  } catch {
    return `[studio-console] 已收到: "${prompt.slice(0, 100)}"。AI 助手功能将在后续阶段接入完整 PI agent runtime。`;
  }
}

async function generatePiAssistantResponse(
  prompt: string,
  _host: unknown,
): Promise<string> {
  // 骨架：返回占位响应
  // 后续阶段：使用 CustomAgentInvoker.invoke() 执行 studio-console agent
  void _host;
  const lower = prompt.toLowerCase();

  if (lower.includes("workflow") || lower.includes("工作流")) {
    return `检测到 workflow 相关查询。你可以使用 /workflows 浏览已有工作流，或 /create-workflow 创建新的工作流。`;
  }
  if (lower.includes("agent") || lower.includes("智能体")) {
    return `检测到 agent 相关查询。你可以使用 /agents 浏览已有智能体，或 /create-agent 创建新的智能体。`;
  }
  if (lower.includes("帮助") || lower.includes("help")) {
    return `输入 /help 查看所有可用命令。输入 exit 退出控制台。`;
  }

  return `我是 pi-studio 的 AI 助手 (studio-console)。我可以帮你浏览工作流、智能体、技能等系统对象，也可以帮你创建新的工作流和智能体。\n\n你可以尝试输入 /help 查看可用命令，或直接描述你的需求。`;
}

// ─── 工作流执行桥接 ──────────────────────────────────────

/**
 * PI display shell 运行上下文。
 * 后续阶段接入完整的 workflow runner + display shell 管线。
 */
export interface PiDisplayContext {
  /** 通过 PI display shell 渲染工作流事件 */
  renderWorkflowRun(workflowId: string): Promise<void>;
  /** 渲染 agent 执行 */
  renderAgentRun(agentId: string): Promise<void>;
}

/**
 * 创建 PI display 上下文（骨架）。
 */
export function createPiDisplayContext(): PiDisplayContext {
  return {
    async renderWorkflowRun(workflowId: string): Promise<void> {
      console.log(
        pc.cyan("[studio]") + " " + pc.dim(`workflow "${workflowId}" 执行预留 — 后续阶段接入 PI WorkflowProgressRenderer`),
      );
    },
    async renderAgentRun(agentId: string): Promise<void> {
      console.log(
        pc.cyan("[studio]") + " " + pc.dim(`agent "${agentId}" 执行预留 — 后续阶段接入 PI InteractiveMode`),
      );
    },
  };
}
