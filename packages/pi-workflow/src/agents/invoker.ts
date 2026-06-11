import type { CustomAgentInvokeRequest, CustomAgentInvokeResult } from "./types.js";
import type { CustomAgentRegistry } from "./registry.js";
import type { WorkflowPiHostCapabilities, WorkflowHostEvent, WorkflowAgentRequest } from "../adapters/pi/types.js";

/** CustomAgentInvoker 的构造选项。 */
export interface CustomAgentInvokerOptions {
  readonly host: WorkflowPiHostCapabilities;
  readonly registry: CustomAgentRegistry;
  readonly config?: import("../config/types.js").WorkflowConfig;
}

/**
 * 独立自定义智能体调用器，不绑定 workflow 节点。
 * 始终从 registry 解析完整定义，构造 WorkflowAgentRequest 后调用 host.runAgent()。
 * host.runNamedAgent() 保留为宿主自行实现的扩展点，未要求 invoker 必须优先使用。
 */
export class CustomAgentInvoker {
  constructor(private options: CustomAgentInvokerOptions) {}

  /**
   * 调用一个独立自定义智能体，返回事件流和最终结果。
   *
   * @param request 调用请求
   * @yields 宿主事件流（text_delta、tool_start 等）
   * @returns 调用结果
   */
  async *invoke(
    request: CustomAgentInvokeRequest,
  ): AsyncGenerator<WorkflowHostEvent, CustomAgentInvokeResult> {
    const { host, registry } = this.options;

    const normalized = registry.get(request.agentId);
    if (!normalized && !request.resolvedAssembly) {
      yield { type: "agent.error", error: `自定义智能体 "${request.agentId}" 未找到` };
      return {
        agentId: request.agentId,
        content: "",
        output: null,
      };
    }

    const resolved = request.resolvedAssembly ?? (normalized
      ? {
          id: normalized.id,
          prompt: {
            systemPrompt: normalized.systemPrompt ?? "You are a helpful assistant.",
            userPrompt: request.prompt ?? JSON.stringify(request.input ?? {}),
            initialMessages: request.initialMessages ?? normalized.initialMessages,
          },
          model: normalized.model
            ? {
                id: normalized.model.provider && normalized.model.model
                  ? `${normalized.model.provider}/${normalized.model.model}`
                  : undefined,
                provider: normalized.model.provider,
                name: normalized.model.model,
                temperature: normalized.model.temperature,
                maxTokens: normalized.model.maxTokens,
              }
            : undefined,
          skills: normalized.skills,
          tools: normalized.tools,
          executableTools: [],
          workflowTools: [],
          mcp: normalized.mcp,
          permissions: normalized.permissions,
          runtimeMode: normalized.runtimeMode,
          uiProfile: normalized.uiProfile,
          diagnostics: normalized.diagnostics,
          metadata: normalized.metadata,
        }
      : undefined);

    const systemPrompt = request.systemPrompt ?? resolved?.prompt.systemPrompt ?? "You are a helpful assistant.";
    const userPrompt = request.prompt ?? JSON.stringify(request.input ?? {});

    const modelFromConfig = this.options.config?.model
      ? `${this.options.config.model.provider ?? ""}/${this.options.config.model.model ?? ""}`
      : undefined;

    const model = request.model ?? resolved?.model?.id ?? modelFromConfig ?? undefined;

    const agentRequest: WorkflowAgentRequest = {
      nodeId: `custom-agent-${request.agentId}`,
      systemPrompt,
      prompt: userPrompt,
      input: request.input ?? {},
      model,
      temperature: request.temperature ?? resolved?.model?.temperature,
      maxTokens: request.maxTokens ?? resolved?.model?.maxTokens,
      skills: request.skills ?? resolved?.skills,
      tools: request.tools ?? resolved?.tools,
      mcp: request.mcp ?? resolved?.mcp,
      signal: request.signal,
      toolExecutors: request.toolExecutors,
      initialMessages: request.initialMessages ?? resolved?.prompt.initialMessages,
    };

    const gen = host.runAgent(agentRequest);
    let content = "";
    let hadEvent = false;
    for await (const event of gen) {
      hadEvent = true;
      yield event;
      if (event.type === "agent.text_delta") {
        content += event.delta;
      }
    }

    if (!hadEvent) {
      yield { type: "agent.error", error: "模型未返回任何输出，请检查 API Key、网络或模型响应" };
      return { agentId: request.agentId, content: "", output: null };
    }

    return {
      agentId: request.agentId,
      content,
      output: content || null,
    };
  }
}
