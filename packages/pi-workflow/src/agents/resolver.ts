import type { ValueRef, WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowConfig } from "../config/types.js";
import { resolveModelConfig, formatModelString } from "../config/resolver.js";
import type { AgentDefinition, ResolvedAgentConfig, WorkflowToolDefinition, ResolvedAgentModelSettings } from "./types.js";
import type { AgentRegistry } from "./registry.js";

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
  registry: AgentRegistry,
): ResolvedAgentConfig {
  const agentId = node.executor?.config?.agentId as string | undefined;

  let agentDef: AgentDefinition | undefined;
  if (agentId) {
    agentDef = registry.get(agentId);
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

  if (config.workflowTools) {
    for (const [name, def] of Object.entries(config.workflowTools)) {
      merged[name] = { name, ...def };
    }
  }

  if (agentDef?.workflowTools) {
    for (const [name, def] of Object.entries(agentDef.workflowTools)) {
      merged[name] = { name, ...def };
    }
  }

  const nodeTools = node.capabilities?.tools ?? [];
  for (const toolRef of nodeTools) {
    if (toolRef.source === "workflow" && toolRef.name) {
      merged[toolRef.name] = {
        ...merged[toolRef.name],
        name: toolRef.name,
        description: toolRef.description ?? merged[toolRef.name]?.description,
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
