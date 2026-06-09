import type { WorkflowHostCapabilities } from "../../host/types.js";
import type { PermissionCapability } from "../../security/types.js";
import type { WorkflowSkillRefIR, WorkflowToolRefIR, WorkflowMcpConfigIR } from "../../ir/types.js";
import type { WorkflowSessionCheckpoint } from "../../store/types.js";
import type { CustomAgentInvokeRequest } from "../../agents/types.js";

/** 向 PI Agent 发起的运行请求。 */
export interface WorkflowAgentRequest {
  readonly nodeId: string;
  readonly systemPrompt?: string;
  readonly prompt: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly signal?: AbortSignal;
  readonly toolExecutors?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
  readonly initialMessages?: ReadonlyArray<{
    readonly role: "user" | "assistant";
    readonly content: string | readonly { readonly type: "text"; readonly text: string }[];
  }>;
}

/** Agent 运行的结果。 */
export interface WorkflowAgentResult {
  readonly output: unknown;
  readonly content: string;
}

/** 工具调用的请求参数。 */
export interface WorkflowToolRequest {
  readonly toolCallId?: string;
  readonly nodeId?: string;
  readonly toolName: string;
  readonly params: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

/** 工具调用的执行结果。 */
export interface WorkflowToolResult {
  readonly content: string;
  readonly isError: boolean;
  readonly details?: Record<string, unknown>;
}

/** PI 宿主在 Agent 执行过程中发出的事件。 */
export type WorkflowHostEvent =
  | { readonly type: "agent.text_delta"; readonly delta: string }
  | { readonly type: "agent.tool_start"; readonly toolName: string }
  | { readonly type: "agent.tool_end"; readonly toolName: string }
  | { readonly type: "agent.skill_start"; readonly skillName: string }
  | { readonly type: "agent.skill_end"; readonly skillName: string }
  | { readonly type: "agent.mcp_start"; readonly serverName: string }
  | { readonly type: "agent.mcp_end"; readonly serverName: string }
  | { readonly type: "agent.error"; readonly error: string };

/** 宿主可注册的工具记录，用于 callTool() 的查找和执行。 */
export interface HostCallableToolRecord {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  readonly capability?: PermissionCapability;
  readonly source: "builtin" | "native" | "extension";
  readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean; details?: Record<string, unknown> }>;
}

/** 对 PI 生态中某个资源的引用。 */
export interface WorkflowResourceRef {
  readonly kind: "skill" | "prompt" | "tool";
  readonly name: string;
  readonly packageSource?: string;
}

/** 资源列表的查询过滤条件。 */
export interface WorkflowResourceQuery {
  readonly kind?: string;
  readonly packageName?: string;
}

/** 已解析的资源内容。 */
export interface WorkflowResolvedResource {
  readonly ref: WorkflowResourceRef;
  readonly content: unknown;
}

/** 对 PI 包的引用。 */
export interface WorkflowPiPackageRef {
  readonly alias: string;
  readonly source: string;
  readonly version?: string;
}

/** 对 PI 生态中某项能力的引用。 */
export interface WorkflowPiCapabilityRef {
  readonly name: string;
  readonly packageSource?: string;
  readonly description?: string;
}

/** PI 生态能力目录，包含所有可用包、技能、提示和工具。 */
export interface WorkflowCapabilityCatalog {
  readonly packages: readonly WorkflowPiPackageRef[];
  readonly skills: readonly WorkflowPiCapabilityRef[];
  readonly prompts: readonly WorkflowPiCapabilityRef[];
  readonly tools: readonly WorkflowPiCapabilityRef[];
}
/** PI 宿主能力的完整接口定义，涵盖 Agent 运行、工具调用、资源查询、用户交互与会话。 */
export interface WorkflowPiHostCapabilities extends WorkflowHostCapabilities {
  runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
  runNamedAgent?(
    request: CustomAgentInvokeRequest,
  ): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
  checkPermission?(capability: string, resource?: string): Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string };
  callTool?(request: WorkflowToolRequest): Promise<WorkflowToolResult>;
  listResources?(query: WorkflowResourceQuery): Promise<readonly WorkflowResourceRef[]>;
  resolveResource?(ref: WorkflowResourceRef): Promise<WorkflowResolvedResource>;
  requestUserInput?(request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult>;
  appendSessionCheckpoint?(checkpoint: WorkflowSessionCheckpoint): Promise<void>;
  readSessionCheckpoints?(): Promise<readonly WorkflowSessionCheckpoint[]>;
}

/** 向用户发起的交互请求参数。 */
export interface WorkflowInteractionRequest {
  readonly nodeId: string;
  readonly interactionId: string;
  readonly question: string;
  readonly expectedFormat?: string;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

/** 用户交互的输入结果。 */
export interface WorkflowInteractionResult {
  readonly input: Readonly<Record<string, unknown>>;
}
