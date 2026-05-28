import type { ModelConfig, NodeConfig, ExecutorConfig } from "./types.js";
import type { AgentDefinition, WorkflowToolDefinition } from "../agents/types.js";
import type { TomlLoadError } from "./toml-loader.js";
import { parsePermissionGrants } from "./toml-security-parsers.js";

/** 解析 TOML model 段，验证类型并提取 provider / model / variant / temperature / maxTokens。 */
export function parseModelConfig(val: unknown, filePath?: string, errors?: TomlLoadError[]): ModelConfig {
  if (typeof val !== "object" || val === null) {
    errors?.push({ path: filePath ?? "", message: "model 必须是表 (table) 类型" });
    return {};
  }
  const m = val as Record<string, unknown>;
  return {
    provider: typeof m["provider"] === "string" ? m["provider"] : undefined,
    model: typeof m["model"] === "string" ? m["model"] : undefined,
    variant: typeof m["variant"] === "string" ? m["variant"] : undefined,
    temperature: typeof m["temperature"] === "number" ? m["temperature"] : undefined,
    maxTokens: typeof m["maxTokens"] === "number" ? m["maxTokens"] : undefined,
  };
}

/** 解析 TOML nodes 段，每个节点支持独立的 model 覆盖配置。 */
export function parseNodesConfig(val: unknown, filePath?: string, errors?: TomlLoadError[]): Record<string, NodeConfig> | undefined {
  if (typeof val !== "object" || val === null) return undefined;
  const nodes: Record<string, NodeConfig> = {};
  for (const [key, nodeVal] of Object.entries(val as Record<string, unknown>)) {
    if (typeof nodeVal !== "object" || nodeVal === null) {
      errors?.push({ path: filePath ?? "", message: `nodes.${key} 必须是表类型` });
      continue;
    }
    const n = nodeVal as Record<string, unknown>;
    const nodeConfig: NodeConfig = {};
    if (n["model"] != null) {
      nodeConfig.model = parseModelConfig(n["model"], filePath, errors);
    }
    nodes[key] = nodeConfig;
  }
  return Object.keys(nodes).length > 0 ? nodes : undefined;
}

/** 解析 TOML executor 段，提取超时、最大嵌套深度及重试策略。 */
export function parseExecutorConfig(val: unknown, _filePath?: string, _errors?: TomlLoadError[]): ExecutorConfig | undefined {
  if (typeof val !== "object" || val === null) return undefined;
  const e = val as Record<string, unknown>;
  const executor: ExecutorConfig = {};
  if (typeof e["timeoutMs"] === "number") executor.timeoutMs = e["timeoutMs"];
  if (typeof e["maxWorkflowToolDepth"] === "number") executor.maxWorkflowToolDepth = e["maxWorkflowToolDepth"];
  if (typeof e["retry"] === "object" && e["retry"] !== null) {
    const r = e["retry"] as Record<string, unknown>;
    const retry: Record<string, unknown> = {};
    if (typeof r["maxAttempts"] === "number") retry.maxAttempts = r["maxAttempts"];
    if (typeof r["delayMs"] === "number") retry.delayMs = r["delayMs"];
    if (typeof r["backoff"] === "string") retry.backoff = r["backoff"];
    executor.retry = retry as Partial<import("../ir/types.js").WorkflowRetryPolicy>;
  }
  return Object.keys(executor).length > 0 ? executor : undefined;
}

/** 解析 TOML packages 段，验证每项为字符串格式（如 "npm:my-pkg@^1.0.0"）。 */
export function parsePackagesConfig(val: unknown, filePath?: string, errors?: TomlLoadError[]): Record<string, string> | undefined {
  if (typeof val !== "object" || val === null) return undefined;
  const packages: Record<string, string> = {};
  for (const [key, pkgVal] of Object.entries(val as Record<string, unknown>)) {
    if (typeof pkgVal !== "string") {
      errors?.push({ path: filePath ?? "", message: `packages.${key} 必须是字符串 (如 "npm:my-package@^1.0.0")` });
      continue;
    }
    packages[key] = pkgVal;
  }
  return Object.keys(packages).length > 0 ? packages : undefined;
}


/** 解析 TOML agents 段，转换为 AgentDefinition（不含 id），支持 name / model / skills / tools / workflowTools / mcp。 */
export function parseAgentsConfig(
  val: unknown,
  filePath?: string,
  errors?: TomlLoadError[],
): Record<string, Omit<AgentDefinition, "id">> | undefined {
  if (!isRecord(val)) return undefined;

  const agents: Record<string, Omit<AgentDefinition, "id">> = {};
  for (const [key, agentVal] of Object.entries(val)) {
    if (!isRecord(agentVal)) {
      errors?.push({ path: filePath ?? "", message: `agents.${key} 必须是表类型` });
      continue;
    }

    agents[key] = {
      name: typeof agentVal["name"] === "string" ? agentVal["name"] : undefined,
      description: typeof agentVal["description"] === "string" ? agentVal["description"] : undefined,
      systemPrompt: typeof agentVal["systemPrompt"] === "string" ? agentVal["systemPrompt"] : undefined,
      model: agentVal["model"] != null ? parseModelConfig(agentVal["model"], filePath, errors) : undefined,
      temperature: typeof agentVal["temperature"] === "number" ? agentVal["temperature"] : undefined,
      maxTokens: typeof agentVal["maxTokens"] === "number" ? agentVal["maxTokens"] : undefined,
      skills: parseNamedRefs(agentVal["skills"], `agents.${key}.skills`, filePath, errors),
      tools: parseToolRefs(agentVal["tools"], `agents.${key}.tools`, filePath, errors),
      workflowTools: parseWorkflowToolsConfig(agentVal["workflowTools"], filePath, errors),
      mcp: parseMcpRefs(agentVal["mcp"], `agents.${key}.mcp`, filePath, errors),
      permissions: parseOptionalPermissions(agentVal["permissions"], `agents.${key}.permissions`, filePath, errors),
    };
  }

  return Object.keys(agents).length > 0 ? agents : undefined;
}

/** 解析 TOML workflowTools 段，转换为 WorkflowToolDefinition（不含 name），支持 workflowPath / inputSchema / outputSchema。 */
export function parseWorkflowToolsConfig(
  val: unknown,
  filePath?: string,
  errors?: TomlLoadError[],
): Record<string, Omit<WorkflowToolDefinition, "name">> | undefined {
  if (!isRecord(val)) return undefined;

  const workflowTools: Record<string, Omit<WorkflowToolDefinition, "name">> = {};
  for (const [key, toolVal] of Object.entries(val)) {
    if (!isRecord(toolVal)) {
      errors?.push({ path: filePath ?? "", message: `workflowTools.${key} 必须是表类型` });
      continue;
    }

    workflowTools[key] = {
      description: typeof toolVal["description"] === "string" ? toolVal["description"] : undefined,
      workflowPath: typeof toolVal["workflowPath"] === "string" ? toolVal["workflowPath"] : undefined,
      inputSchema: isRecord(toolVal["inputSchema"]) ? toolVal["inputSchema"] : undefined,
      outputSchema: isRecord(toolVal["outputSchema"]) ? toolVal["outputSchema"] : undefined,
      permissions: parseOptionalPermissions(toolVal["permissions"], `workflowTools.${key}.permissions`, filePath, errors),
    };
  }

  return Object.keys(workflowTools).length > 0 ? workflowTools : undefined;
}

/** 解析通用名称引用数组，支持字符串形式或 `{ name, source }` 对象形式。 */
export function parseNamedRefs(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): Array<{ name: string; source?: string }> | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  const refs: Array<{ name: string; source?: string }> = [];
  for (const item of val) {
    if (typeof item === "string") {
      refs.push({ name: item });
      continue;
    }
    if (isRecord(item) && typeof item.name === "string") {
      refs.push({ name: item.name, source: typeof item.source === "string" ? item.source : undefined });
      continue;
    }
    errors?.push({ path: filePath ?? "", message: `${field} 项必须是字符串或带 name 的对象` });
  }

  return refs.length > 0 ? refs : undefined;
}

/** 解析工具引用数组，支持字符串或 `{ name, source, description }` 对象形式。 */
export function parseToolRefs(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): Array<{ name: string; source?: string; description?: string }> | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  const refs: Array<{ name: string; source?: string; description?: string }> = [];
  for (const item of val) {
    if (typeof item === "string") {
      refs.push({ name: item });
      continue;
    }
    if (isRecord(item) && typeof item.name === "string") {
      refs.push({
        name: item.name,
        source: typeof item.source === "string" ? item.source : undefined,
        description: typeof item.description === "string" ? item.description : undefined,
      });
      continue;
    }
    errors?.push({ path: filePath ?? "", message: `${field} 项必须是字符串或带 name 的对象` });
  }

  return refs.length > 0 ? refs : undefined;
}

/** 解析 MCP 引用数组，支持字符串或 `{ server }` 对象形式。 */
export function parseMcpRefs(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): Array<{ server: string }> | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  const refs: Array<{ server: string }> = [];
  for (const item of val) {
    if (typeof item === "string") {
      refs.push({ server: item });
      continue;
    }
    if (isRecord(item) && typeof item.server === "string") {
      refs.push({ server: item.server });
      continue;
    }
    errors?.push({ path: filePath ?? "", message: `${field} 项必须是字符串或带 server 的对象` });
  }

  return refs.length > 0 ? refs : undefined;
}

/** 类型守卫：判断值是否为非 null 的对象。 */
function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

/** 解析可选 permissions 数组，复用 security 段的 capability/scope 校验。 */
function parseOptionalPermissions(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
) {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  return parsePermissionGrants(val, filePath, errors);
}
