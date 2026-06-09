import type { ValueRef, WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowConfig } from "../config/types.js";
import { resolveModelConfig, formatModelString } from "../config/resolver.js";
import type { AgentDefinition, CustomAgentDefinition, ResolvedAgentConfig, WorkflowToolDefinition, ResolvedAgentModelSettings } from "./types.js";
import type { CustomAgentRegistry } from "./registry.js";

/**
 * 独立解析自定义智能体定义，不绑定 workflow 节点。
 * 返回直接从 registry 获取的定义，不做 workflow 级合并。
 *
 * @param agentId 智能体 ID
 * @param registry 自定义智能体注册中心
 * @returns 自定义智能体定义，不存在时返回 undefined
 */
export function resolveCustomAgentDefinition(
  agentId: string,
  registry: CustomAgentRegistry,
): CustomAgentDefinition | undefined {
  return registry.get(agentId);
}

/**
 * 合并节点、全局配置与 Agent 定义，解析出最终的 Agent 运行配置。
 *
 * @param node 工作流节点 IR
 * @param config 全局工作流配置
 * @param registry Agent 注册中心
 * @returns 合并后的完整 Agent 配置
 */
export function resolveAgentConfig(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  registry: CustomAgentRegistry,
): ResolvedAgentConfig {
  const agentId = node.executor?.config?.agentId as string | undefined;

  let agentDef: AgentDefinition | undefined;
  if (agentId) {
    const def = registry.get(agentId);
    agentDef = def as AgentDefinition | undefined;
  }

  const modelConfig = mergeModelConfig(node, config, agentDef);

  const nodeInput = node.inputBindings ?? {};
  const systemPrompt = resolveSystemPrompt(nodeInput, agentDef);

  const merged: ResolvedAgentConfig = {
    systemPrompt,
    userPrompt: resolveUserPrompt(nodeInput),
    model: modelConfig,
    temperature: agentDef?.temperature,
    maxTokens: agentDef?.maxTokens,
    skills: mergeSkills(agentDef, node),
    tools: mergeTools(agentDef, node),
    workflowTools: mergeWorkflowTools(config, agentDef, node),
    mcp: mergeMcp(agentDef, node),
    permissions: agentDef?.permissions ?? [],
  };

  return merged;
}

/**
 * Workflow 兼容解析：解析 workflow agent 节点的调用参数，
 * 从独立智能体定义加载基础配置，再合并节点级覆盖项。
 *
 * @param node 工作流节点 IR
 * @param config 全局工作流配置
 * @param registry 自定义智能体注册中心
 * @param nodeInput 节点输入参数
 * @returns 合并后的运行参数，包含 systemPrompt / userPrompt / model 等
 */
export function resolveWorkflowAgentInvocation(
  node: WorkflowNodeIR,
  config: WorkflowConfig | undefined,
  registry: CustomAgentRegistry,
  nodeInput: Record<string, unknown>,
): {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  skills?: readonly import("../ir/types.js").WorkflowSkillRefIR[];
  tools?: readonly import("../ir/types.js").WorkflowToolRefIR[];
  mcp?: readonly import("../ir/types.js").WorkflowMcpConfigIR[];
  permissions?: readonly import("../security/types.js").PermissionGrant[];
} {
  const agentId = node.executor?.config?.agentId as string | undefined;
  const agentDef: AgentDefinition | undefined = agentId
    ? (registry.get(agentId) as AgentDefinition | undefined)
    : undefined;

  const modelFromInput = typeof nodeInput["model"] === "string" ? nodeInput["model"] as string : undefined;
  const modelFromDef = agentDef?.model ? formatModelString(agentDef.model) : undefined;
  const modelFromConfig = config?.model ? formatModelString(resolveModelConfig(node, config)) : undefined;

  return {
    systemPrompt: (nodeInput["system_prompt"] as string)
      ?? (nodeInput["systemPrompt"] as string)
      ?? agentDef?.systemPrompt
      ?? "You are a helpful assistant.",
    userPrompt: (nodeInput["user_prompt"] as string)
      ?? (nodeInput["userPrompt"] as string)
      ?? (nodeInput["prompt"] as string)
      ?? JSON.stringify(nodeInput),
    model: modelFromInput ?? modelFromDef ?? modelFromConfig,
    temperature: nodeInput["temperature"] as number | undefined ?? agentDef?.temperature,
    maxTokens: (nodeInput["max_tokens"] as number | undefined)
      ?? (nodeInput["maxTokens"] as number | undefined)
      ?? agentDef?.maxTokens,
    skills: mergeAgentNodeSkills(agentDef, node),
    tools: mergeAgentNodeTools(agentDef, node),
    mcp: mergeAgentNodeMcp(agentDef, node),
    permissions: agentDef?.permissions,
  };
}

function mergeAgentNodeSkills(
  agentDef: AgentDefinition | undefined,
  node: WorkflowNodeIR,
): readonly import("../ir/types.js").WorkflowSkillRefIR[] | undefined {
  const agentSkills = agentDef?.skills ?? [];
  const nodeSkills = node.capabilities?.skills ?? [];
  if (agentSkills.length === 0 && nodeSkills.length === 0) return undefined;
  const seen = new Set<string>();
  return [...agentSkills, ...nodeSkills].filter(s => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

function mergeAgentNodeTools(
  agentDef: AgentDefinition | undefined,
  node: WorkflowNodeIR,
): readonly import("../ir/types.js").WorkflowToolRefIR[] | undefined {
  const agentTools = agentDef?.tools ?? [];
  const nodeTools = node.capabilities?.tools ?? [];
  if (agentTools.length === 0 && nodeTools.length === 0) return undefined;
  const seen = new Set<string>();
  return [...agentTools, ...nodeTools].filter(t => {
    const key = `${t.name}:${t.source ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAgentNodeMcp(
  agentDef: AgentDefinition | undefined,
  node: WorkflowNodeIR,
): readonly import("../ir/types.js").WorkflowMcpConfigIR[] | undefined {
  const agentMcp = agentDef?.mcp ?? [];
  const nodeMcp = node.capabilities?.mcp ?? [];
  if (agentMcp.length === 0 && nodeMcp.length === 0) return undefined;
  const seen = new Set<string>();
  return [...agentMcp, ...nodeMcp].filter(m => {
    if (seen.has(m.server)) return false;
    seen.add(m.server);
    return true;
  });
}

/**
 * 解析节点输入中的模型设置（model / temperature / maxTokens），
 * 节点输入优先，回退到已解析的 Agent 配置。
 * 兼容 user_prompt / userPrompt / prompt 输入键名。
 *
 * @param _node 工作流节点 IR（当前仅用于类型签名）
 * @param nodeInput 节点输入参数
 * @param resolved 已解析的 Agent 配置
 * @returns 模型设置参数
 */
export function resolveAgentModelSettings(
  _node: WorkflowNodeIR,
  nodeInput: Record<string, unknown>,
  resolved: ResolvedAgentConfig,
): ResolvedAgentModelSettings {
  return {
    model: typeof nodeInput["model"] === "string"
      ? (nodeInput["model"] as string)
      : (resolved.model ? formatModelString(resolved.model) : undefined),
    temperature: typeof nodeInput["temperature"] === "number"
      ? (nodeInput["temperature"] as number)
      : resolved.temperature,
    maxTokens: typeof nodeInput["max_tokens"] === "number"
      ? (nodeInput["max_tokens"] as number)
      : typeof nodeInput["maxTokens"] === "number"
        ? (nodeInput["maxTokens"] as number)
        : resolved.maxTokens,
  };
}

function resolveSystemPrompt(
  inputBindings: Record<string, unknown>,
  agentDef: AgentDefinition | undefined,
): string {
  return readLiteralString(inputBindings["system_prompt"])
    ?? readLiteralString(inputBindings["systemPrompt"])
    ?? agentDef?.systemPrompt
    ?? "You are a helpful assistant.";
}

function resolveUserPrompt(inputBindings: Record<string, unknown>): string | undefined {
  return readLiteralString(inputBindings["user_prompt"])
    ?? readLiteralString(inputBindings["userPrompt"])
    ?? readLiteralString(inputBindings["prompt"])
    ?? undefined;
}

function readLiteralString(valueRef: unknown): string | undefined {
  if (!valueRef || typeof valueRef !== "object") {
    return undefined;
  }

  const ref = valueRef as ValueRef;
  if (ref.from !== "literal") {
    return undefined;
  }

  return typeof ref.value === "string" ? ref.value : undefined;
}

function mergeSkills(agentDef: AgentDefinition | undefined, node: WorkflowNodeIR): readonly import("../ir/types.js").WorkflowSkillRefIR[] {
  const agentSkills = agentDef?.skills ?? [];
  const nodeSkills = node.capabilities?.skills ?? [];
  const seen = new Set<string>();
  const result: import("../ir/types.js").WorkflowSkillRefIR[] = [];

  for (const s of [...agentSkills, ...nodeSkills]) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      result.push(s);
    }
  }

  return result;
}

function mergeTools(agentDef: AgentDefinition | undefined, node: WorkflowNodeIR): readonly import("../ir/types.js").WorkflowToolRefIR[] {
  const agentTools = agentDef?.tools ?? [];
  const nodeTools = node.capabilities?.tools ?? [];
  const seen = new Set<string>();
  const result: import("../ir/types.js").WorkflowToolRefIR[] = [];

  for (const t of [...agentTools, ...nodeTools]) {
    const key = `${t.name}:${t.source ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  return result;
}

function mergeWorkflowTools(
  config: WorkflowConfig,
  agentDef: AgentDefinition | undefined,
  node: WorkflowNodeIR,
): Record<string, WorkflowToolDefinition> {
  const merged: Record<string, WorkflowToolDefinition> = {};

  if (agentDef?.workflowTools) {
    for (const [name, def] of Object.entries(agentDef.workflowTools)) {
      merged[name] = { name, ...def };
    }
  }

  const nodeTools = node.capabilities?.tools ?? [];
  for (const toolRef of nodeTools) {
    if (toolRef.source === "workflow" && toolRef.name) {
      const globalDef = config.workflowTools?.[toolRef.name];
      merged[toolRef.name] = {
        ...globalDef,
        ...merged[toolRef.name],
        name: toolRef.name,
        description: toolRef.description ?? merged[toolRef.name]?.description ?? globalDef?.description,
      };
    }
  }

  return merged;
}

function mergeMcp(
  agentDef: AgentDefinition | undefined,
  node: WorkflowNodeIR,
): readonly import("../ir/types.js").WorkflowMcpConfigIR[] {
  const agentMcp = agentDef?.mcp ?? [];
  const nodeMcp = node.capabilities?.mcp ?? [];
  const seen = new Set<string>();
  const result: import("../ir/types.js").WorkflowMcpConfigIR[] = [];

  for (const m of [...agentMcp, ...nodeMcp]) {
    if (!seen.has(m.server)) {
      seen.add(m.server);
      result.push(m);
    }
  }

  return result;
}

function mergeModelConfig(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  agentDef: AgentDefinition | undefined,
) {
  const configModel = resolveModelConfig(node, config);
  return {
    ...configModel,
    ...agentDef?.model,
    temperature: agentDef?.temperature ?? agentDef?.model?.temperature ?? configModel.temperature,
    maxTokens: agentDef?.maxTokens ?? agentDef?.model?.maxTokens ?? configModel.maxTokens,
  };
}
