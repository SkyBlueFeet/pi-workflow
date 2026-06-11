import type {
  AgentAssemblyDiagnostic,
  AgentAssemblyMeta,
  AgentMessageSpec,
  NormalizedPiAgentAssembly,
  PiAgentAssemblySpec,
  PiExtensionRef,
  ToolExposeRef,
  WorkflowToolDefinition,
} from "./types.js";
import type { ModelConfig } from "../config/types.js";
import type { WorkflowMcpConfigIR, WorkflowSkillRefIR, WorkflowToolRefIR } from "../ir/types.js";

/** 标准化参数，允许 registry 提供父定义查找与来源信息。 */
export interface NormalizeAgentAssemblyOptions {
  readonly meta?: AgentAssemblyMeta;
  readonly resolveParent?: (id: string) => PiAgentAssemblySpec | undefined;
}

/** 标准化结果，包含标准化 assembly 与结构化诊断。 */
export interface NormalizeAgentAssemblyResult {
  readonly assembly: NormalizedPiAgentAssembly;
  readonly diagnostics: readonly AgentAssemblyDiagnostic[];
}

/** 将原始 spec 归一化为统一 Assembly 模型。 */
export function normalizeAgentAssembly(
  spec: PiAgentAssemblySpec,
  options: NormalizeAgentAssemblyOptions = {},
): NormalizeAgentAssemblyResult {
  const diagnostics: AgentAssemblyDiagnostic[] = [];
  const preparedSpec = prepareSpecForNormalization(spec);
  const lineage = linearizeInheritance(preparedSpec, options.resolveParent, diagnostics, []);
  const merged = mergeLineage(lineage, diagnostics);

  const normalized: NormalizedPiAgentAssembly = {
    id: merged.id,
    name: merged.name,
    description: merged.description,
    model: normalizeModel(mergeLegacyModelFields(merged, diagnostics), diagnostics, merged.id),
    systemPrompt: merged.systemPrompt,
    initialMessages: merged.initialMessages,
    skills: merged.skills ?? [],
    tools: normalizeToolRefs(merged.tools, merged.id, diagnostics) ?? [],
    extensions: merged.extensions ?? [],
    mcp: merged.mcp ?? [],
    permissions: merged.permissions ?? [],
    runtimeMode: merged.runtime?.mode ?? "pi-tui",
    uiProfile: merged.runtime?.uiProfile,
    workflowOverlay: {
      workflowTools: ensureNamedWorkflowTools(getWorkflowToolSource(merged)),
      maxWorkflowToolDepth: merged.workflowOverlay?.maxWorkflowToolDepth,
    },
    diagnostics,
    metadata: {
      originPath: options.meta?.originPath ?? merged.metadata?.originPath,
      extra: merged.metadata?.extra,
    },
  };

  return { assembly: normalized, diagnostics };
}

function linearizeInheritance(
  spec: PiAgentAssemblySpec,
  resolveParent: NormalizeAgentAssemblyOptions["resolveParent"],
  diagnostics: AgentAssemblyDiagnostic[],
  trail: readonly string[],
): readonly PiAgentAssemblySpec[] {
  const agentId = spec.id;
  if (trail.includes(agentId)) {
    diagnostics.push(createDiagnostic({
      agentId,
      code: "agent.extends.cycle",
      severity: "error",
      phase: "normalize",
      message: `检测到循环继承: ${[...trail, agentId].join(" -> ")}`,
      fieldPath: "extends",
      source: agentId,
    }));
    return [stripExtends(spec)];
  }

  const parents = spec.extends ?? [];
  const resolvedParents: PiAgentAssemblySpec[] = [];
  for (const parentId of parents) {
    const parent = resolveParent?.(parentId);
    if (!parent) {
      diagnostics.push(createDiagnostic({
        agentId,
        code: "agent.extends.missing",
        severity: "error",
        phase: "normalize",
        message: `智能体 "${agentId}" 引用了不存在的父定义 "${parentId}"`,
        fieldPath: "extends",
        source: agentId,
      }));
      continue;
    }

    resolvedParents.push(...linearizeInheritance(parent, resolveParent, diagnostics, [...trail, agentId]));
  }

  return [...resolvedParents, stripExtends(spec)];
}

function mergeLineage(
  lineage: readonly PiAgentAssemblySpec[],
  diagnostics: AgentAssemblyDiagnostic[],
): PiAgentAssemblySpec {
  return lineage.reduce<PiAgentAssemblySpec>((merged, current) => {
    const workflowOverlay = mergeWorkflowOverlay(
      merged.workflowOverlay,
      current.workflowOverlay,
      diagnostics,
      current.id,
    );

    return {
      ...merged,
      ...current,
      model: mergeModelBlocks(merged.model, current.model),
      initialMessages: current.initialMessages ?? merged.initialMessages,
      skills: current.skills ?? merged.skills,
      tools: normalizeToolRefs(
        current.tools,
        current.id,
        diagnostics,
      ) ?? merged.tools,
      extensions: current.extensions ?? merged.extensions,
      mcp: current.mcp ?? merged.mcp,
      permissions: current.permissions ?? merged.permissions,
      runtime: {
        ...merged.runtime,
        ...current.runtime,
      },
      workflowOverlay,
      metadata: {
        originPath: current.metadata?.originPath ?? merged.metadata?.originPath,
        extra: {
          ...(merged.metadata?.extra ?? {}),
          ...(current.metadata?.extra ?? {}),
        },
      },
    };
  }, lineage[0] ?? { id: "unknown" });
}

function mergeWorkflowOverlay(
  parent: PiAgentAssemblySpec["workflowOverlay"],
  current: PiAgentAssemblySpec["workflowOverlay"],
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): PiAgentAssemblySpec["workflowOverlay"] {
  const parentTools = parent?.workflowTools ?? {};
  const currentTools = current?.workflowTools ?? {};

  for (const name of Object.keys(parentTools)) {
    if (name in currentTools) {
      diagnostics.push(createDiagnostic({
        agentId,
        code: "agent.workflowTool.override",
        severity: "info",
        phase: "normalize",
        message: `workflow tool "${name}" 在继承链中被后续定义覆盖`,
        fieldPath: `workflowOverlay.workflowTools.${name}`,
        source: agentId,
      }));
    }
  }

  return {
    workflowTools: {
      ...toNamedWorkflowTools(parentTools),
      ...toNamedWorkflowTools(currentTools),
    },
    maxWorkflowToolDepth: current?.maxWorkflowToolDepth ?? parent?.maxWorkflowToolDepth,
  };
}

function ensureNamedWorkflowTools(
  defs: Record<string, WorkflowToolDefinition> | Record<string, Omit<WorkflowToolDefinition, "name">> | undefined,
): Record<string, WorkflowToolDefinition> {
  if (!defs) {
    return {};
  }

  const named: Record<string, WorkflowToolDefinition> = {};
  for (const [name, def] of Object.entries(defs)) {
    if ("name" in def && typeof def.name === "string") {
      named[name] = {
        name: def.name,
        description: def.description,
        workflowPath: def.workflowPath,
        workflow: def.workflow,
        inputSchema: def.inputSchema,
        outputSchema: def.outputSchema,
        permissions: def.permissions,
      };
    } else {
      named[name] = createNamedWorkflowTool(name, def as Omit<WorkflowToolDefinition, "name">);
    }
  }
  return named;
}

function toNamedWorkflowTools(
  defs: Record<string, Omit<WorkflowToolDefinition, "name">>,
): Record<string, WorkflowToolDefinition> {
  const named: Record<string, WorkflowToolDefinition> = {};
  for (const [name, value] of Object.entries(defs)) {
    named[name] = createNamedWorkflowTool(name, value);
  }
  return named;
}

function createNamedWorkflowTool(
  name: string,
  value: Omit<WorkflowToolDefinition, "name">,
): WorkflowToolDefinition {
  return {
    name,
    description: value.description,
    workflowPath: value.workflowPath,
    workflow: value.workflow,
    inputSchema: value.inputSchema,
    outputSchema: value.outputSchema,
    permissions: value.permissions,
  };
}

function normalizeModel(
  model: ModelConfig | undefined,
  diagnostics: AgentAssemblyDiagnostic[],
  agentId: string,
): ModelConfig | undefined {
  if (!model) {
    return undefined;
  }

  if (!model.provider || !model.model) {
    diagnostics.push(createDiagnostic({
      agentId,
      code: "agent.model.incomplete",
      severity: "warning",
      phase: "normalize",
      message: `智能体 "${agentId}" 的 model 缺少 provider 或 model 字段`,
      fieldPath: "model",
      source: agentId,
    }));
  }

  return model;
}

function mergeLegacyModelFields(
  spec: PiAgentAssemblySpec,
  diagnostics: AgentAssemblyDiagnostic[],
): ModelConfig | undefined {
  const merged: ModelConfig | undefined = spec.model
    ? { ...spec.model }
    : spec.temperature !== undefined || spec.maxTokens !== undefined
      ? {}
      : undefined;

  if (!merged) {
    return undefined;
  }

  if (spec.temperature !== undefined && merged.temperature === undefined) {
    diagnostics.push(createDiagnostic({
      agentId: spec.id,
      code: "agent.model.legacy-temperature",
      severity: "info",
      phase: "normalize",
      message: `顶层 temperature 已归一化到 model.temperature`,
      fieldPath: "temperature",
      source: spec.id,
    }));
    merged.temperature = spec.temperature;
  }

  if (spec.maxTokens !== undefined && merged.maxTokens === undefined) {
    diagnostics.push(createDiagnostic({
      agentId: spec.id,
      code: "agent.model.legacy-maxTokens",
      severity: "info",
      phase: "normalize",
      message: `顶层 maxTokens 已归一化到 model.maxTokens`,
      fieldPath: "maxTokens",
      source: spec.id,
    }));
    merged.maxTokens = spec.maxTokens;
  }

  return merged;
}

function normalizeToolRefs(
  refs: readonly ToolExposeRef[] | readonly WorkflowToolRefIR[] | undefined,
  agentId: string,
  diagnostics: AgentAssemblyDiagnostic[],
): readonly ToolExposeRef[] | undefined {
  if (!refs) {
    return undefined;
  }

  return refs.map((ref) => normalizeSingleToolRef(ref, agentId, diagnostics));
}

function normalizeSingleToolRef(
  ref: ToolExposeRef | WorkflowToolRefIR,
  agentId: string,
  diagnostics: AgentAssemblyDiagnostic[],
): ToolExposeRef {
  if ("type" in ref) {
    return ref;
  }

  if (!ref.source) {
    diagnostics.push(createDiagnostic({
      agentId,
      code: "agent.tools.legacy.default-builtin",
      severity: "warning",
      phase: "normalize",
      message: `legacy tool "${ref.name}" 未声明 source，已按 builtin 归一化`,
      fieldPath: `tools.${ref.name}`,
      source: agentId,
    }));
    return { type: "builtin", name: ref.name, source: "builtin" };
  }

  if (ref.source === "workflow") {
    return { type: "workflow", name: ref.name };
  }

  if (ref.source === "builtin") {
    return { type: "builtin", name: ref.name, source: "builtin" };
  }

  if (ref.source === "native") {
    return { type: "native", name: ref.name, source: "native" };
  }

  diagnostics.push(createDiagnostic({
    agentId,
    code: "agent.tools.legacy.extension-source",
    severity: "info",
    phase: "normalize",
    message: `legacy tool "${ref.name}" 的 source="${ref.source}" 已映射为 extension 工具引用`,
    fieldPath: `tools.${ref.name}`,
    source: agentId,
  }));
  return { type: "extension", extension: ref.source, name: ref.name };
}

function mergeModelBlocks(
  parent: ModelConfig | undefined,
  current: ModelConfig | undefined,
): ModelConfig | undefined {
  if (!parent) {
    return current;
  }
  if (!current) {
    return parent;
  }
  return {
    ...parent,
    ...current,
  };
}

function stripExtends(spec: PiAgentAssemblySpec): PiAgentAssemblySpec {
  const { extends: _extends, ...rest } = spec;
  return rest;
}

function getWorkflowToolSource(
  spec: PiAgentAssemblySpec,
): Record<string, WorkflowToolDefinition> | Record<string, Omit<WorkflowToolDefinition, "name">> | undefined {
  return spec.workflowOverlay?.workflowTools ?? spec.workflowTools;
}

function prepareSpecForNormalization(spec: PiAgentAssemblySpec): PiAgentAssemblySpec {
  if (spec.workflowTools || spec.temperature !== undefined || spec.maxTokens !== undefined) {
    return createAssemblySpecFromLegacyDefinition(spec.id, spec);
  }
  return spec;
}

function createDiagnostic(input: AgentAssemblyDiagnostic): AgentAssemblyDiagnostic {
  return input;
}

/** 兼容 TOML parser 仍使用旧结构时的转换入口。 */
export function createAssemblySpecFromLegacyDefinition(
  id: string,
  definition: {
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
    readonly permissions?: readonly { readonly capability: string; readonly scope?: Readonly<Record<string, unknown>> }[];
    readonly extends?: readonly string[];
    readonly extensions?: readonly PiExtensionRef[];
    readonly runtime?: { readonly mode?: string; readonly uiProfile?: string };
    readonly workflowOverlay?: {
      readonly workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
      readonly maxWorkflowToolDepth?: number;
    };
    readonly initialMessages?: readonly AgentMessageSpec[];
    readonly metadata?: { readonly originPath?: string; readonly extra?: Record<string, unknown> };
  },
): PiAgentAssemblySpec {
  const legacyWorkflowTools = definition.workflowTools;
  const workflowOverlay = definition.workflowOverlay;

  return {
    id,
    name: definition.name,
    description: definition.description,
    extends: definition.extends,
    systemPrompt: definition.systemPrompt,
    model: {
      ...definition.model,
      temperature: definition.model?.temperature ?? definition.temperature,
      maxTokens: definition.model?.maxTokens ?? definition.maxTokens,
    },
    initialMessages: definition.initialMessages,
    skills: definition.skills,
    tools: definition.tools as readonly ToolExposeRef[] | undefined,
    extensions: definition.extensions,
    mcp: definition.mcp,
    permissions: definition.permissions as NormalizedPiAgentAssembly["permissions"],
    runtime: definition.runtime,
    workflowOverlay: {
      workflowTools: workflowOverlay?.workflowTools ?? legacyWorkflowTools,
      maxWorkflowToolDepth: workflowOverlay?.maxWorkflowToolDepth,
    },
    metadata: definition.metadata,
  };
}
