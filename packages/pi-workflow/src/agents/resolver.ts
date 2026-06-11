import type { WorkflowConfig } from "../config/types.js";
import { formatModelString, resolveModelConfig } from "../config/resolver.js";
import type {
  ValueRef,
  WorkflowMcpConfigIR,
  WorkflowNodeIR,
  WorkflowSkillRefIR,
} from "../ir/types.js";
import type { CustomAgentRegistry } from "./registry.js";
import {
  createAssemblySpecFromLegacyDefinition,
  normalizeAgentAssembly as normalizeAssemblyInternal,
  type NormalizeAgentAssemblyOptions,
  type NormalizeAgentAssemblyResult,
} from "./assembly-normalizer.js";
import type {
  AgentAssemblyDiagnostic,
  AgentNodeCapabilitiesOverlay,
  CustomAgentDefinition,
  NormalizedPiAgentAssembly,
  PiAgentAssemblySpec,
  ResolvedAgentModelSettings,
  ResolvedExecutableToolBinding,
  ResolvedPiAgentAssembly,
  ResolvedWorkflowTool,
  ToolExposeRef,
  WorkflowToolDefinition,
} from "./types.js";
import { resolveWorkflowTools } from "./workflow-tool-bridge.js";

export type { NormalizeAgentAssemblyOptions, NormalizeAgentAssemblyResult } from "./assembly-normalizer.js";

/** 对外导出统一 normalizer。 */
export function normalizeAgentAssembly(
  spec: PiAgentAssemblySpec,
  options: NormalizeAgentAssemblyOptions = {},
): NormalizeAgentAssemblyResult {
  return normalizeAssemblyInternal(spec, options);
}

/** 兼容旧代码路径：从 registry 取出标准化后的定义。 */
export function resolveCustomAgentDefinition(
  agentId: string,
  registry: CustomAgentRegistry,
): CustomAgentDefinition | undefined {
  return registry.get(agentId);
}

/** workflow/CLI 共用解析：在 normalized assembly 基础上应用 overlay 与运行时输入。 */
export function resolveAgentAssembly(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  registry: CustomAgentRegistry,
  nodeInput: Record<string, unknown> = {},
): ResolvedPiAgentAssembly {
  const diagnostics: AgentAssemblyDiagnostic[] = [];
  const normalized = resolveNormalizedAssembly(node, config, registry, diagnostics);
  const overlay = buildNodeOverlay(node, diagnostics);
  const skills = applySkillOverlay(normalized.skills, overlay.skills, diagnostics, normalized.id);
  const tools = applyToolOverlay(normalized.tools, overlay.tools, diagnostics, normalized.id);
  const mcp = applyMcpOverlay(normalized.mcp, overlay.mcp, diagnostics, normalized.id);
  const workflowToolRefs = tools.filter((tool): tool is Extract<ToolExposeRef, { type: "workflow" }> => tool.type === "workflow");
  const resolvedWorkflowTools = resolveWorkflowTools(
    {
      systemPrompt: normalized.systemPrompt ?? "You are a helpful assistant.",
      model: normalized.model,
      temperature: normalized.model?.temperature,
      maxTokens: normalized.model?.maxTokens,
      skills: normalized.skills,
      tools: normalized.tools,
      workflowTools: filterWorkflowToolsByExposure(normalized.workflowOverlay.workflowTools, workflowToolRefs),
      mcp: normalized.mcp,
      permissions: normalized.permissions,
    },
    config,
    normalized.metadata?.originPath ?? config.baseDir,
  );

  for (const error of resolvedWorkflowTools.errors) {
    diagnostics.push({
      code: "agent.workflowTool.resolve-failed",
      severity: "error",
      phase: "resolve",
      message: error.message,
      source: normalized.id,
      fieldPath: `workflowOverlay.workflowTools.${error.name}`,
      agentId: normalized.id,
    });
  }

  const executableTools = buildExecutableToolBindings(
    tools,
    resolvedWorkflowTools.tools,
    diagnostics,
    normalized.id,
  );

  const effectiveModel = mergeResolvedModel(node, config, normalized, nodeInput);
  return {
    id: normalized.id,
    prompt: {
      systemPrompt: resolveSystemPromptFromInput(nodeInput) ?? normalized.systemPrompt ?? "You are a helpful assistant.",
      userPrompt: resolveUserPrompt(nodeInput),
      initialMessages: normalized.initialMessages,
    },
    model: effectiveModel,
    skills,
    tools,
    executableTools,
    workflowTools: resolvedWorkflowTools.tools,
    mcp,
    permissions: normalized.permissions,
    runtimeMode: normalized.runtimeMode,
    uiProfile: normalized.uiProfile,
    diagnostics: [...normalized.diagnostics, ...diagnostics],
    metadata: normalized.metadata,
  };
}

/** 兼容旧入口名，内部已改为返回新 resolved assembly。 */
export function resolveAgentConfig(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  registry: CustomAgentRegistry,
): ResolvedPiAgentAssembly {
  return resolveAgentAssembly(node, config, registry, readLiteralInputBindings(node.inputBindings));
}

/** workflow agent 节点运行参数解析，保留给现有调用方过渡使用。 */
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
  skills?: readonly WorkflowSkillRefIR[];
  tools?: readonly ToolExposeRef[];
  mcp?: readonly WorkflowMcpConfigIR[];
  permissions?: readonly import("../security/types.js").PermissionGrant[];
  resolvedAssembly?: ResolvedPiAgentAssembly;
} {
  if (!config) {
    const prompt = resolveUserPrompt(nodeInput) ?? JSON.stringify(nodeInput);
    return {
      systemPrompt: resolveSystemPromptFromInput(nodeInput) ?? "You are a helpful assistant.",
      userPrompt: prompt,
      model: typeof nodeInput["model"] === "string" ? nodeInput["model"] as string : undefined,
    };
  }

  const resolved = resolveAgentAssembly(node, config, registry, nodeInput);
  return {
    systemPrompt: resolved.prompt.systemPrompt,
    userPrompt: resolved.prompt.userPrompt ?? JSON.stringify(nodeInput),
    model: resolved.model?.id,
    temperature: resolved.model?.temperature,
    maxTokens: resolved.model?.maxTokens,
    skills: resolved.skills,
    tools: resolved.tools,
    mcp: resolved.mcp,
    permissions: resolved.permissions,
    resolvedAssembly: resolved,
  };
}

/** 从节点输入与 resolved assembly 中提取模型设置，供过渡调用路径复用。 */
export function resolveAgentModelSettings(
  _node: WorkflowNodeIR,
  nodeInput: Record<string, unknown>,
  resolved: ResolvedPiAgentAssembly,
): ResolvedAgentModelSettings {
  const nodeModel = readNodeModelOverride(nodeInput);
  return {
    model: nodeModel?.id ?? resolved.model?.id,
    temperature: nodeModel?.temperature ?? resolved.model?.temperature,
    maxTokens: nodeModel?.maxTokens ?? resolved.model?.maxTokens,
  };
}

function resolveNormalizedAssembly(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  registry: CustomAgentRegistry,
  diagnostics: AgentAssemblyDiagnostic[],
): NormalizedPiAgentAssembly {
  const executorConfig = node.executor?.config as Record<string, unknown> | undefined;
  const agentId = typeof executorConfig?.["agentId"] === "string"
    ? executorConfig["agentId"] as string
    : undefined;

  if (typeof executorConfig?.["agentConfigPath"] === "string" || typeof executorConfig?.["agentRef"] === "string") {
    diagnostics.push({
      code: "agent.external.unsupported",
      severity: "error",
      phase: "resolve",
      message: `节点 "${node.id}" 当前不支持通过 agentConfigPath/agentRef 引用外部 agent 配置文件，请改为引用当前配置文件中的 WorkflowConfig.agents，或直接在节点 inputs 中提供最小 agent 运行参数`,
      source: node.id,
      fieldPath: "executor.config.agentConfigPath",
    });
  }

  if (!agentId) {
    return normalizeAssemblyInternal({
      id: "_inline-node-agent",
      model: resolveModelConfig(node, config),
      systemPrompt: "You are a helpful assistant.",
    }).assembly;
  }

  const normalized = registry.get(agentId);
  if (normalized) {
    return normalized;
  }

  diagnostics.push({
    code: "agent.missing",
    severity: "error",
    phase: "resolve",
    message: `智能体 "${agentId}" 未找到`,
    source: node.id,
    fieldPath: "executor.config.agentId",
    agentId,
  });
  return normalizeAssemblyInternal({ id: agentId }).assembly;
}

function buildNodeOverlay(
  node: WorkflowNodeIR,
  diagnostics: AgentAssemblyDiagnostic[],
): AgentNodeCapabilitiesOverlay {
  const rawSkills = node.capabilities?.skills;
  const rawTools = node.capabilities?.tools;
  const rawMcp = node.capabilities?.mcp;
  const rawConfig = node.executor?.config as Record<string, unknown> | undefined;

  if (rawConfig?.["temperature"] !== undefined || rawConfig?.["maxTokens"] !== undefined) {
    diagnostics.push({
      code: "agent.node.legacy-model-field",
      severity: "warning",
      phase: "resolve",
      message: `节点 "${node.id}" 仍在使用顶层 temperature/maxTokens 覆盖，已忽略；请迁移到 model.*`,
      source: node.id,
      fieldPath: "executor.config",
    });
  }

  return {
    skills: rawSkills?.length ? { append: rawSkills } : undefined,
    tools: rawTools?.length
      ? { append: rawTools.map((tool) => normalizeLegacyToolRef(tool)) }
      : undefined,
    mcp: rawMcp?.length ? { append: rawMcp } : undefined,
  };
}

function applySkillOverlay(
  base: readonly WorkflowSkillRefIR[],
  overlay: AgentNodeCapabilitiesOverlay["skills"],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly WorkflowSkillRefIR[] {
  const appended = dedupeSkills([...base, ...(overlay?.append ?? [])], diagnostics, agentId);
  if (!overlay?.restrictTo?.length) {
    return appended;
  }
  return appended.filter((skill) => overlay.restrictTo!.includes(toSkillKey(skill)));
}

function applyToolOverlay(
  base: readonly ToolExposeRef[],
  overlay: AgentNodeCapabilitiesOverlay["tools"],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly ToolExposeRef[] {
  const appended = dedupeTools([...base, ...(overlay?.append ?? [])], diagnostics, agentId);
  if (!overlay?.restrictTo?.length) {
    return appended;
  }
  return appended.filter((tool) => overlay.restrictTo!.includes(toToolKey(tool)));
}

function applyMcpOverlay(
  base: readonly WorkflowMcpConfigIR[],
  overlay: AgentNodeCapabilitiesOverlay["mcp"],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly WorkflowMcpConfigIR[] {
  const appended = dedupeMcp([...base, ...(overlay?.append ?? [])], diagnostics, agentId);
  if (!overlay?.restrictTo?.length) {
    return appended;
  }
  return appended.filter((entry) => overlay.restrictTo!.includes(entry.server));
}

function buildExecutableToolBindings(
  tools: readonly ToolExposeRef[],
  workflowTools: readonly ResolvedWorkflowTool[],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly ResolvedExecutableToolBinding[] {
  const workflowToolMap = new Map(workflowTools.map((tool) => [tool.name, tool]));
  const bindings: ResolvedExecutableToolBinding[] = [];

  for (const tool of tools) {
    switch (tool.type) {
      case "workflow": {
        const workflowTool = workflowToolMap.get(tool.name);
        if (!workflowTool) {
          diagnostics.push({
            code: "agent.tool.workflow.missing",
            severity: "error",
            phase: "resolve",
            message: `workflow tool "${tool.name}" 未解析到定义`,
            source: agentId,
            fieldPath: `tools.${tool.name}`,
            agentId,
          });
          break;
        }
        bindings.push({
          ref: tool,
          record: workflowTool,
          requiredPermissions: workflowTool.permissions ?? [{ capability: "workflow.invoke" }],
        });
        break;
      }
      case "builtin":
        bindings.push({
          ref: tool,
          record: createPlaceholderToolRecord(tool.name, "builtin"),
          requiredPermissions: inferBuiltinToolPermissions(tool.name),
        });
        break;
      case "native":
        bindings.push({
          ref: tool,
          record: createPlaceholderToolRecord(tool.name, "native"),
          requiredPermissions: [{ capability: "extension.execute" }],
        });
        break;
      case "extension":
        bindings.push({
          ref: tool,
          record: createPlaceholderToolRecord(tool.name, "extension"),
          requiredPermissions: [{ capability: "extension.execute", scope: { extension: tool.extension } }],
        });
        break;
    }
  }

  return bindings;
}

function createPlaceholderToolRecord(
  name: string,
  source: "builtin" | "native" | "extension",
): import("../adapters/pi/types.js").HostCallableToolRecord {
  return {
    name,
    source,
    execute: async () => ({ content: `工具 "${name}" 尚未在当前运行面绑定执行器`, isError: true }),
  };
}

function inferBuiltinToolPermissions(name: string) {
  switch (name) {
    case "write":
    case "edit":
      return [{ capability: "fs.write" as const }];
    case "read":
    case "grep":
    case "find":
    case "ls":
      return [{ capability: "fs.read" as const }];
    default:
      return [{ capability: "extension.execute" as const }];
  }
}

function mergeResolvedModel(
  node: WorkflowNodeIR,
  config: WorkflowConfig,
  normalized: NormalizedPiAgentAssembly,
  nodeInput: Record<string, unknown>,
): ResolvedPiAgentAssembly["model"] {
  const workflowModel = resolveModelConfig(node, config);
  const assemblyModel = normalized.model;
  const nodeModel = readNodeModelOverride(nodeInput);
  const model = {
    provider: nodeModel?.provider ?? assemblyModel?.provider ?? workflowModel.provider,
    name: nodeModel?.name ?? assemblyModel?.model ?? workflowModel.model,
    temperature: nodeModel?.temperature ?? assemblyModel?.temperature ?? workflowModel.temperature,
    maxTokens: nodeModel?.maxTokens ?? assemblyModel?.maxTokens ?? workflowModel.maxTokens,
  };

  const id = model.provider && model.name ? `${model.provider}/${model.name}` : undefined;
  return {
    id,
    provider: model.provider,
    name: model.name,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
  };
}

function readNodeModelOverride(
  nodeInput: Record<string, unknown>,
): ResolvedPiAgentAssembly["model"] | undefined {
  if (typeof nodeInput["model"] === "string") {
    const [provider, name] = (nodeInput["model"] as string).split("/");
    return { id: nodeInput["model"] as string, provider, name };
  }

  const modelBlock = nodeInput["model"];
  if (typeof modelBlock === "object" && modelBlock !== null) {
    const record = modelBlock as Record<string, unknown>;
    const provider = typeof record["provider"] === "string" ? record["provider"] : undefined;
    const name = typeof record["model"] === "string" ? record["model"] : undefined;
    const temperature = typeof record["temperature"] === "number" ? record["temperature"] : undefined;
    const maxTokens = typeof record["maxTokens"] === "number" ? record["maxTokens"] : undefined;
    return {
      id: provider && name ? `${provider}/${name}` : undefined,
      provider,
      name,
      temperature,
      maxTokens,
    };
  }

  return undefined;
}

function dedupeSkills(
  skills: readonly WorkflowSkillRefIR[],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly WorkflowSkillRefIR[] {
  const seen = new Map<string, WorkflowSkillRefIR>();
  for (const skill of skills) {
    const key = toSkillKey(skill);
    if (seen.has(key)) {
      diagnostics.push({
        code: "agent.skills.duplicate",
        severity: "info",
        phase: "resolve",
        message: `skill "${key}" 被后续 overlay 覆盖`,
        source: agentId,
        fieldPath: `skills.${skill.name}`,
        agentId,
      });
    }
    seen.set(key, skill);
  }
  return Array.from(seen.values());
}

function dedupeTools(
  tools: readonly ToolExposeRef[],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly ToolExposeRef[] {
  const seen = new Map<string, ToolExposeRef>();
  for (const tool of tools) {
    const key = toToolKey(tool);
    if (seen.has(key)) {
      diagnostics.push({
        code: "agent.tools.duplicate",
        severity: "info",
        phase: "resolve",
        message: `tool "${key}" 被后续 overlay 覆盖`,
        source: agentId,
        fieldPath: `tools.${tool.type}`,
        agentId,
      });
    }
    seen.set(key, tool);
  }
  return Array.from(seen.values());
}

function dedupeMcp(
  entries: readonly WorkflowMcpConfigIR[],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): readonly WorkflowMcpConfigIR[] {
  const seen = new Map<string, WorkflowMcpConfigIR>();
  for (const entry of entries) {
    if (seen.has(entry.server)) {
      diagnostics.push({
        code: "agent.mcp.duplicate",
        severity: "info",
        phase: "resolve",
        message: `MCP "${entry.server}" 被后续 overlay 覆盖`,
        source: agentId,
        fieldPath: `mcp.${entry.server}`,
        agentId,
      });
    }
    seen.set(entry.server, entry);
  }
  return Array.from(seen.values());
}

function toSkillKey(skill: WorkflowSkillRefIR): string {
  return `${skill.name}:${skill.source ?? "default"}`;
}

function toToolKey(tool: ToolExposeRef): string {
  switch (tool.type) {
    case "builtin":
    case "native":
      return `${tool.type}:${tool.source ?? tool.type}:${tool.name}`;
    case "extension":
      return `${tool.type}:${tool.extension}:${tool.name}`;
    case "workflow":
      return `${tool.type}:${tool.name}`;
  }
}

function normalizeLegacyToolRef(tool: import("../ir/types.js").WorkflowToolRefIR): ToolExposeRef {
  if (tool.source === "workflow") {
    return { type: "workflow", name: tool.name };
  }
  if (tool.source === "native") {
    return { type: "native", name: tool.name, source: "native" };
  }
  if (tool.source && tool.source !== "builtin") {
    return { type: "extension", extension: tool.source, name: tool.name };
  }
  return { type: "builtin", name: tool.name, source: "builtin" };
}

function filterWorkflowToolsByExposure(
  workflowTools: Record<string, WorkflowToolDefinition>,
  refs: readonly Extract<ToolExposeRef, { type: "workflow" }>[],
): Record<string, WorkflowToolDefinition> {
  if (refs.length === 0) {
    return {};
  }

  const allowed = new Set(refs.map((ref) => ref.name));
  const filtered: Record<string, WorkflowToolDefinition> = {};
  for (const [name, definition] of Object.entries(workflowTools)) {
    if (allowed.has(name)) {
      filtered[name] = definition;
    }
  }
  return filtered;
}

function resolveSystemPromptFromInput(input: Record<string, unknown>): string | undefined {
  return typeof input["system_prompt"] === "string"
    ? input["system_prompt"] as string
    : typeof input["systemPrompt"] === "string"
      ? input["systemPrompt"] as string
      : undefined;
}

function resolveUserPrompt(input: Record<string, unknown>): string | undefined {
  return typeof input["user_prompt"] === "string"
    ? input["user_prompt"] as string
    : typeof input["userPrompt"] === "string"
      ? input["userPrompt"] as string
      : typeof input["prompt"] === "string"
        ? input["prompt"] as string
        : undefined;
}

function readLiteralInputBindings(inputBindings: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputBindings)) {
    const literal = readLiteralValue(value);
    if (literal !== undefined) {
      result[key] = literal;
    }
  }
  return result;
}

function readLiteralValue(valueRef: unknown): unknown {
  if (!valueRef || typeof valueRef !== "object") {
    return undefined;
  }

  const ref = valueRef as ValueRef;
  return ref.from === "literal" ? ref.value : undefined;
}
