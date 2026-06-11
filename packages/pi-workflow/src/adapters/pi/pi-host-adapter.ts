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
  WorkflowToolRequest,
  WorkflowToolResult,
  HostCallableToolRecord,
} from "./types.js";
import type { CustomAgentInvokeRequest } from "../../agents/types.js";
import type { WorkflowSkillRefIR, WorkflowToolRefIR, WorkflowMcpConfigIR } from "../../ir/types.js";

/** PI 宿主适配器的构造选项。 */
export interface PiHostAdapterOptions {
  readonly defaultModel?: string;
  readonly model?: any;
  readonly permissionCheck?: (capability: string, resource?: string) => Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string };
  readonly nativeTools?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
    readonly parameters?: Record<string, unknown>;
    readonly capability?: HostCallableToolRecord["capability"];
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean; details?: Record<string, unknown> }>;
  }>;
  readonly extensionTools?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
    readonly parameters?: Record<string, unknown>;
    readonly capability?: HostCallableToolRecord["capability"];
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean; details?: Record<string, unknown> }>;
  }>;
  readonly builtinTools?: ReadonlyArray<HostCallableToolRecord>;
}

/**
 * PI 宿主的完整适配器，桥接 pi-agent-core 与 WorkflowRuntime。
 * 负责模型解析、工具合并、callTool 执行及事件转发。
 */
export class PiHostAdapter implements WorkflowPiHostCapabilities {
  emitEvent?(_event: WorkflowRuntimeEvent): void | Promise<void> {}

  private toolRegistry = new Map<string, HostCallableToolRecord>();
  private lastAgentToolNames: readonly string[] = [];

  constructor(private options: PiHostAdapterOptions = {}) {
    this.buildToolRegistry();
  }

  /** 根据 options 构建统一工具注册表。查找顺序：builtin > native > extension */
  private buildToolRegistry(): void {
    const builtin = this.options.builtinTools ?? [];
    const native = (this.options.nativeTools ?? []).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? t.inputSchema,
      capability: t.capability,
      source: "native" as const,
      execute: t.execute,
    }));
    const extension = (this.options.extensionTools ?? []).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? t.inputSchema,
      capability: t.capability ?? "extension.execute" as const,
      source: "extension" as const,
      execute: t.execute,
    }));

    const addWithPriority = (tool: HostCallableToolRecord, source: string) => {
      const existing = this.toolRegistry.get(tool.name);
      if (existing) {
        console.warn(`[PiHostAdapter] 工具 "${tool.name}" 已存在 (来源: ${existing.source})，跳过 ${source} 来源`);
        return;
      }
      this.toolRegistry.set(tool.name, tool);
    };

    for (const t of builtin) addWithPriority(t, "builtin");
    for (const t of native) addWithPriority(t, "native");
    for (const t of extension) addWithPriority(t, "extension");
  }

  async callTool(request: WorkflowToolRequest): Promise<WorkflowToolResult> {
    const tool = this.toolRegistry.get(request.toolName);
    if (!tool) {
      return { content: `工具未找到: ${request.toolName}`, isError: true };
    }

    if (tool.capability && this.options.permissionCheck) {
      const permResult = await this.options.permissionCheck(tool.capability);
      if (!permResult.allowed) {
        return { content: `[PI] ${permResult.reason ?? "权限拒绝"}`, isError: true };
      }
    }

    try {
      const result = await tool.execute(request.params);
      return { content: result.content, isError: result.isError, details: result.details };
    } catch (err) {
      return { content: err instanceof Error ? err.message : String(err), isError: true };
    }
  }

  checkPermission(capability: string, resource?: string): Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string } {
    if (!this.options.permissionCheck) {
      return { allowed: true };
    }

    return this.options.permissionCheck(capability, resource);
  }

  async requestUserInput(request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult> {
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
    const gen = this.executeAgentCore({
      modelId: request.model,
      systemPrompt: request.systemPrompt,
      prompt: request.prompt,
      skills: request.skills,
      tools: request.tools,
      mcp: request.mcp,
      toolExecutors: request.toolExecutors,
      initialMessages: request.initialMessages,
      signal: request.signal,
    });
    return yield* gen;
  }

  async *runNamedAgent(
    request: CustomAgentInvokeRequest,
  ): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    const gen = this.executeAgentCore({
      modelId: request.model,
      systemPrompt: undefined,
      prompt: request.prompt ?? JSON.stringify(request.input ?? {}),
      signal: request.signal,
    });
    return yield* gen;
  }

  /**
   * 共享的 agent 执行核心，供 runAgent 和 runNamedAgent 复用。
   */
  private async *executeAgentCore(params: {
    modelId?: string;
    systemPrompt?: string;
    prompt: string;
    skills?: readonly WorkflowSkillRefIR[];
    tools?: readonly WorkflowToolRefIR[];
    mcp?: readonly WorkflowMcpConfigIR[];
    toolExecutors?: ReadonlyArray<{ name: string; execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }> }>;
    initialMessages?: ReadonlyArray<{ role: "user" | "assistant"; content: string | readonly { type: "text"; text: string }[] }>;
    signal?: AbortSignal;
  }): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    const requestExecutors = params.toolExecutors ?? [];
    const executorMap = new Map(requestExecutors.map(e => [e.name, e.execute]));

    const baseTools = params.tools?.length
      ? params.tools.map(t => this.toAgentTool(t, executorMap.get(t.name) ?? this.resolveRegisteredToolExecutor(t.name)))
      : [];
    const agentTools = baseTools.length ? baseTools : undefined;
    this.lastAgentToolNames = agentTools?.map(tool => tool.name) ?? [];

    const model = params.modelId
      ? this.resolveModel(params.modelId)
      : (this.options.model ?? this.resolveModel(this.options.defaultModel ?? "openai/gpt-4o-mini"));

    if (!model) {
      yield { type: "agent.error", error: `不支持的模型: ${params.modelId ?? this.options.defaultModel ?? "openai/gpt-4o-mini"}` };
      return { output: null, content: "" };
    }

    if (params.skills?.length) {
      for (const skill of params.skills) {
        yield { type: "agent.skill_start", skillName: skill.name };
        yield { type: "agent.skill_end", skillName: skill.name };
      }
    }

    if (params.mcp?.length) {
      for (const mcp of params.mcp) {
        yield { type: "agent.mcp_start", serverName: mcp.server };
        yield { type: "agent.mcp_end", serverName: mcp.server };
      }
    }

    const agentState: Record<string, unknown> = {
      systemPrompt: params.systemPrompt ?? "You are a helpful assistant.",
      model,
      tools: agentTools ?? [],
    };
    if (params.initialMessages) {
      agentState["messages"] = params.initialMessages;
    }

    const agent = new Agent({
      initialState: agentState as any,
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

    agent.prompt(params.prompt).catch((err: unknown) => {
      eventQueue.push({
        type: "agent.error" as const,
        error: err instanceof Error ? err.message : String(err),
      });
      done = true;
    });

    while (!done || eventQueue.length > 0) {
      while (eventQueue.length > 0) {
        const hostEvent = eventQueue.shift()!;
        yield hostEvent;
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
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        if (!executor) {
          return {
            content: [{ type: "text" as const, text: `工具未绑定执行器: ${ref.name}` }],
            details: { isError: true },
          };
        }
        const result = await executor(params);
        return { content: [{ type: "text" as const, text: result.content }], details: { isError: result.isError } };
      },
    };
  }

  /**
   * 当调用方只声明了可用工具名、但未额外注入 toolExecutors 时，
   * 回退到宿主自身工具注册表，保证 builtin/native/extension 工具可直接执行。
   */
  private resolveRegisteredToolExecutor(
    toolName: string,
  ): ((params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>) | undefined {
    if (!this.toolRegistry.has(toolName)) {
      return undefined;
    }

    return async (params: Record<string, unknown>) => {
      const result = await this.callTool({ toolName, params });
      return { content: result.content, isError: result.isError };
    };
  }
}
