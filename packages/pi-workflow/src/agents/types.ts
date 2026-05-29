import type { ModelConfig } from "../config/types.js";
import type { WorkflowSkillRefIR, WorkflowToolRefIR, WorkflowMcpConfigIR, WorkflowDefinitionIR } from "../ir/types.js";
import type { PermissionGrant } from "../security/types.js";

/** 工作流工具的完整定义，可包含内联 IR 或文件路径引用。 */
export interface WorkflowToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly workflowPath?: string;
  readonly workflow?: WorkflowDefinitionIR;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly permissions?: readonly PermissionGrant[];
}

/** Agent 的完整定义，包含提示词、模型配置及能力引用。 */
export interface AgentDefinition {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly systemPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly permissions?: readonly PermissionGrant[];
}

/** 经过合并解析后的最终 Agent 运行配置。 */
export interface ResolvedAgentConfig {
  readonly systemPrompt: string;
  readonly userPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly WorkflowToolRefIR[];
  readonly workflowTools: Record<string, WorkflowToolDefinition>;
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
}

/** 宿主可直接调用的工具接口，提供名称、描述与执行方法。 */
export interface HostCallableTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}

/** 智能体解析后的宿主调用参数。 */
export interface ResolvedAgentModelSettings {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/** 独立自定义智能体定义，宿主级一等能力对象，不绑定 workflow。 */
export interface CustomAgentDefinition {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly systemPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly permissions?: readonly PermissionGrant[];
}

/** 独立自定义智能体调用请求。 */
export interface CustomAgentInvokeRequest {
  readonly agentId: string;
  readonly prompt?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  readonly systemPrompt?: string;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly toolExecutors?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
  readonly initialMessages?: ReadonlyArray<{
    readonly role: "user" | "assistant";
    readonly content: string | readonly { readonly type: "text"; readonly text: string }[];
  }>;
}

/** 独立自定义智能体调用结果。 */
export interface CustomAgentInvokeResult {
  readonly agentId: string;
  readonly content: string;
  readonly output: unknown;
  readonly model?: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}
