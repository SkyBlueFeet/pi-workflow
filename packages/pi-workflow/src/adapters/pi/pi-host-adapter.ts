import { Agent } from "@earendil-works/pi-agent-core";
import { getModel, getModels, Type } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import { createInterface } from "node:readline";
import type { WorkflowRuntimeEvent } from "../../events/types.js";
import type {
  WorkflowPiHostCapabilities,
  WorkflowAgentRequest,
  WorkflowAgentResult,
  WorkflowHostEvent,
  WorkflowInteractionRequest,
  WorkflowInteractionResult,
} from "./types.js";
import type { WorkflowToolRefIR } from "../../ir/types.js";

/** PI 宿主适配器的构造选项。 */
export interface PiHostAdapterOptions {
  readonly defaultModel?: string;
  readonly model?: any;
  readonly permissionCheck?: (capability: string, resource?: string) => Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string };
  readonly extensionTools?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
}

/**
 * PI 宿主的完整适配器，桥接 pi-agent-core 与 WorkflowRuntime。
 * 负责模型解析、工具合并及事件转发。
 */
export class PiHostAdapter implements WorkflowPiHostCapabilities {
  emitEvent?(_event: WorkflowRuntimeEvent): void | Promise<void> {}

  constructor(private options: PiHostAdapterOptions = {}) {}

  checkPermission(capability: string, resource?: string): Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string } {
    if (!this.options.permissionCheck) {
      return { allowed: true };
    }

    return this.options.permissionCheck(capability, resource);
  }

  async requestUserInput(request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult> {
    if (!process.stdin.isTTY) {
      return { input: { approved: false, answer: "deny" } };
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`\n[ask_user] ${request.question}`);
      if (request.options?.length) {
        request.options.forEach((option, index) => {
          console.log(`  ${index + 1}. ${option}`);
        });
      }
      const answer = await new Promise<string>((resolve) => rl.question("选择或输入: ", resolve));
      const normalized = answer.trim();
      const selectedOption = request.options?.[Number(normalized) - 1];
      const selected = selectedOption ?? normalized;
      const approved = selected === "允许一次"
        || selected === "允许本次运行"
        || selected === "永久允许"
        || selected.toLowerCase() === "y"
        || selected.toLowerCase() === "yes";
      return { input: { approved, answer: selected, selected } };
    } finally {
      rl.close();
    }
  }

  async *runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    const model = request.model
      ? this.resolveModel(request.model)
      : (this.options.model ?? this.resolveModel(this.options.defaultModel ?? "openai/gpt-4o-mini"));

    if (!model) {
      yield { type: "agent.error", error: `不支持的模型: ${request.model ?? this.options.defaultModel ?? "openai/gpt-4o-mini"}` };
      return { output: null, content: "" };
    }

    const extraExecutors = this.options.extensionTools ?? [];
    const requestExecutors = request.toolExecutors ?? [];
    const mergedExecutors = [...requestExecutors, ...extraExecutors];
    const executorMap = new Map(mergedExecutors.map(e => [e.name, e.execute]));

    const baseTools = request.tools?.length ? request.tools.map(t => this.toAgentTool(t, executorMap.get(t.name))) : [];
    const extraTools = extraExecutors
      .filter(e => !request.tools?.some(t => t.name === e.name))
      .map(e => this.toAgentToolDirect(e));
    const agentTools = baseTools.length || extraTools.length ? [...baseTools, ...extraTools] : undefined;

    if (request.skills?.length) {
      for (const skill of request.skills) {
        yield { type: "agent.skill_start", skillName: skill.name };
        yield { type: "agent.skill_end", skillName: skill.name };
      }
    }

    if (request.mcp?.length) {
      for (const mcp of request.mcp) {
        yield { type: "agent.mcp_start", serverName: mcp.server };
        yield { type: "agent.mcp_end", serverName: mcp.server };
      }
    }

    const agent = new Agent({
      initialState: {
        systemPrompt: request.systemPrompt ?? "You are a helpful assistant.",
        model,
        tools: agentTools ?? [],
      },
    });

    const eventQueue: WorkflowHostEvent[] = [];
    let done = false;
    let finalResult: WorkflowAgentResult = { output: null, content: "" };

    agent.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        eventQueue.push({ type: "agent.text_delta", delta: event.assistantMessageEvent.delta });
      }
      if (event.type === "tool_execution_start") {
        eventQueue.push({ type: "agent.tool_start", toolName: event.toolName });
      }
      if (event.type === "tool_execution_end") {
        eventQueue.push({ type: "agent.tool_end", toolName: event.toolName });
      }
      if (event.type === "agent_end") {
        const content = agent.state.messages
          .filter(m => m.role === "assistant")
          .map(m => {
            if (typeof m.content === "string") return m.content;
            if (Array.isArray(m.content)) return m.content.filter(c => c.type === "text").map(c => c.text).join("");
            return "";
          })
          .join("");
        finalResult = { output: content, content };
        done = true;
      }
    });

    agent.prompt(request.prompt).catch((err: unknown) => {
      eventQueue.push({
        type: "agent.error" as const,
        error: err instanceof Error ? err.message : String(err),
      });
      done = true;
    });

    while (!done || eventQueue.length > 0) {
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }
      if (!done) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    return finalResult;
  }

  private resolveModel(modelId: string): Model<any> | undefined {
    const parts = modelId.split("/");
    if (parts.length === 2) {
      try {
        return getModel(parts[0] as any, parts[1] as any);
      } catch {
        const models = getModels(parts[0] as any);
        const found = models.find(m => m.id === modelId);
        if (found) return found;
      }
    }
    for (const provider of ["faux", "openai", "anthropic", "google", "deepseek", "xai", "groq", "cerebras", "mistral"]) {
      try {
        const models = getModels(provider as any);
        const found = models.find(m => m.id === parts[0] || m.id === modelId);
        if (found) return found;
      } catch { continue; }
    }
    return undefined;
  }

  private toAgentToolDirect(ext: {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }): any {
    return {
      name: ext.name,
      label: ext.name,
      description: ext.description ?? ext.name,
      parameters: ext.inputSchema ? Type.Object(ext.inputSchema as any) : Type.Object({}) as any,
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const result = await ext.execute(params);
        return { content: [{ type: "text" as const, text: result.content }], details: { isError: result.isError } };
      },
    };
  }

  private toAgentTool(
    ref: WorkflowToolRefIR,
    executor?: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>,
  ): any {
    return {
      name: ref.name,
      label: ref.name,
      description: ref.description ?? "",
      parameters: ref.parameters ? Type.Object(ref.parameters as any) : Type.Object({}) as any,
      execute: executor
        ? async (_toolCallId: string, params: Record<string, unknown>) => {
            const result = await executor(params);
            return { content: [{ type: "text" as const, text: result.content }], details: { isError: result.isError } };
          }
        : async (_toolCallId: string, _params: Record<string, unknown>) => {
            return { content: [{ type: "text" as const, text: JSON.stringify(_params) }], details: {} };
          },
    };
  }
}
