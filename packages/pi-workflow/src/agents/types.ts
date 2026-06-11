import type { ModelConfig } from "../config/types.js";
import type {
  WorkflowDefinitionIR,
  WorkflowMcpConfigIR,
  WorkflowSkillRefIR,
  WorkflowToolRefIR,
} from "../ir/types.js";
import type { PermissionGrant } from "../security/types.js";
import type { HostCallableToolRecord } from "../adapters/pi/types.js";

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

/** Agent 初始消息定义，兼容 PI runtime 的消息输入。 */
export interface AgentMessageSpec {
  readonly role: "user" | "assistant";
  readonly content: string | readonly { readonly type: "text"; readonly text: string }[];
}

/** PI extension 来源声明，仅负责声明能力来源而非自动暴露工具。 */
export interface PiExtensionRef {
  readonly name: string;
  readonly source?: string;
  readonly path?: string;
}

/** Tool 暴露白名单的统一引用模型。 */
export type ToolExposeRef =
  | { readonly type: "builtin"; readonly name: string; readonly source?: string }
  | { readonly type: "native"; readonly name: string; readonly source?: string }
  | { readonly type: "extension"; readonly extension: string; readonly name: string }
  | { readonly type: "workflow"; readonly name: string };

/** 结构化装配诊断，覆盖 load/normalize/resolve/backend-check 各阶段。 */
export interface AgentAssemblyDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly phase: "load" | "normalize" | "resolve" | "backend-check";
  readonly message: string;
  readonly source: string;
  readonly fieldPath: string;
  readonly agentId?: string;
}

/** 节点级能力 overlay：仅允许 append / restrictTo 两种显式语义。 */
export interface CapabilityOverlay<T> {
  readonly append?: readonly T[];
  readonly restrictTo?: readonly string[];
}

/** workflow 节点对装配后能力的运行时限制。 */
export interface AgentNodeCapabilitiesOverlay {
  readonly skills?: CapabilityOverlay<WorkflowSkillRefIR>;
  readonly tools?: CapabilityOverlay<ToolExposeRef>;
  readonly mcp?: CapabilityOverlay<WorkflowMcpConfigIR>;
}

/** 当前配置文件内的原始装配规格。 */
export interface PiAgentAssemblySpec {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly extends?: readonly string[];
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly systemPrompt?: string;
  readonly initialMessages?: readonly AgentMessageSpec[];
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly (ToolExposeRef | WorkflowToolRefIR)[];
  readonly extensions?: readonly PiExtensionRef[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly permissions?: readonly PermissionGrant[];
  readonly runtime?: {
    readonly mode?: string;
    readonly uiProfile?: string;
  };
  readonly workflowOverlay?: {
    readonly workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
    readonly maxWorkflowToolDepth?: number;
  };
  readonly workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
  readonly metadata?: {
    readonly originPath?: string;
    readonly extra?: Record<string, unknown>;
  };
}

/** 标准化后的装配模型，已经展开默认值与 legacy 输入归一化。 */
export interface NormalizedPiAgentAssembly {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly model?: ModelConfig;
  readonly systemPrompt?: string;
  readonly initialMessages?: readonly AgentMessageSpec[];
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly ToolExposeRef[];
  readonly extensions: readonly PiExtensionRef[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
  readonly runtimeMode: string;
  readonly uiProfile?: string;
  readonly workflowOverlay: {
    readonly workflowTools: Record<string, WorkflowToolDefinition>;
    readonly maxWorkflowToolDepth?: number;
  };
  readonly diagnostics: readonly AgentAssemblyDiagnostic[];
  readonly metadata?: {
    readonly originPath?: string;
    readonly extra?: Record<string, unknown>;
  };
}

/** 已解析工作流工具，供 workflow runtime 或 TUI backend 直接消费。 */
export interface ResolvedWorkflowTool {
  readonly name: string;
  readonly description?: string;
  readonly workflow: WorkflowDefinitionIR;
  readonly inputSchema?: Record<string, unknown>;
  readonly permissions?: readonly PermissionGrant[];
}

/** 已解析可执行工具绑定，明确工具引用、宿主记录与权限需求。 */
export interface ResolvedExecutableToolBinding {
  readonly ref: ToolExposeRef;
  readonly record: HostCallableToolRecord | ResolvedWorkflowTool;
  readonly requiredPermissions: readonly PermissionGrant[];
}

/** 已解析运行装配，作为 CLI / executor / backend 的统一事实来源。 */
export interface ResolvedPiAgentAssembly {
  readonly id: string;
  readonly prompt: {
    readonly systemPrompt: string;
    readonly userPrompt?: string;
    readonly initialMessages?: readonly AgentMessageSpec[];
  };
  readonly model?: {
    readonly id?: string;
    readonly provider?: string;
    readonly name?: string;
    readonly temperature?: number;
    readonly maxTokens?: number;
  };
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly ToolExposeRef[];
  readonly executableTools: readonly ResolvedExecutableToolBinding[];
  readonly workflowTools: readonly ResolvedWorkflowTool[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
  readonly runtimeMode: string;
  readonly uiProfile?: string;
  readonly diagnostics: readonly AgentAssemblyDiagnostic[];
  readonly metadata?: {
    readonly originPath?: string;
    readonly extra?: Record<string, unknown>;
  };
}

/** 宿主可直接调用的工具接口，提供名称、描述与执行方法。 */
export interface HostCallableTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}

/** Agent 运行时模型设置，保留给 workflow 输入覆盖解析。 */
export interface ResolvedAgentModelSettings {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/** 自定义智能体调用请求，面向 CLI 与 workflow 共用入口。 */
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
  readonly tools?: readonly ToolExposeRef[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly toolExecutors?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
  readonly initialMessages?: readonly AgentMessageSpec[];
  readonly resolvedAssembly?: ResolvedPiAgentAssembly;
}

/** 自定义智能体调用结果。 */
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

/** PI backend 运行时事件，先于 workflow 事件适配产生。 */
export type PiRuntimeEvent =
  | { readonly type: "text_delta"; readonly delta: string }
  | { readonly type: "tool_start"; readonly toolName: string }
  | { readonly type: "tool_end"; readonly toolName: string }
  | { readonly type: "skill_start"; readonly skillName: string }
  | { readonly type: "skill_end"; readonly skillName: string }
  | { readonly type: "mcp_start"; readonly serverName: string }
  | { readonly type: "mcp_end"; readonly serverName: string }
  | { readonly type: "diagnostic"; readonly diagnostic: AgentAssemblyDiagnostic }
  | { readonly type: "unmapped"; readonly eventType: string; readonly payload?: Record<string, unknown> }
  | { readonly type: "run_error"; readonly error: string }
  | { readonly type: "run_complete"; readonly content: string; readonly output?: unknown };

/** loader/registry 保存的来源元信息。 */
export interface AgentAssemblyMeta {
  readonly originPath?: string;
  readonly source: "workflow-config" | "external-file";
}

/** 兼容旧代码路径的定义别名。 */
export type AgentDefinition = PiAgentAssemblySpec;
export type CustomAgentDefinition = NormalizedPiAgentAssembly;
export interface ResolvedAgentConfig {
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly WorkflowToolRefIR[] | readonly ToolExposeRef[];
  readonly workflowTools: Record<string, WorkflowToolDefinition> | readonly ResolvedWorkflowTool[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
}
