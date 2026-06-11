import type { ModelConfig, NodeConfig, ExecutorConfig } from "./types.js";
import type { PiAgentAssemblySpec, WorkflowToolDefinition } from "../agents/types.js";
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


/** 解析 TOML agents 段，转换为 AssemblySpec（不含 id），支持 legacy 与规范字段共存。 */
export function parseAgentsConfig(
  val: unknown,
  filePath?: string,
  errors?: TomlLoadError[],
): Record<string, Omit<PiAgentAssemblySpec, "id">> | undefined {
  if (!isRecord(val)) return undefined;

  const agents: Record<string, Omit<PiAgentAssemblySpec, "id">> = {};
  for (const [key, agentVal] of Object.entries(val)) {
    if (!isRecord(agentVal)) {
      errors?.push({ path: filePath ?? "", message: `agents.${key} 必须是表类型` });
      continue;
    }

    agents[key] = {
      name: typeof agentVal["name"] === "string" ? agentVal["name"] : undefined,
      description: typeof agentVal["description"] === "string" ? agentVal["description"] : undefined,
      extends: parseStringList(agentVal["extends"], `agents.${key}.extends`, filePath, errors),
      systemPrompt: typeof agentVal["systemPrompt"] === "string" ? agentVal["systemPrompt"] : undefined,
      model: agentVal["model"] != null ? parseModelConfig(agentVal["model"], filePath, errors) : undefined,
      temperature: typeof agentVal["temperature"] === "number" ? agentVal["temperature"] : undefined,
      maxTokens: typeof agentVal["maxTokens"] === "number" ? agentVal["maxTokens"] : undefined,
      runtime: parseRuntimeConfig(agentVal["runtime"], `agents.${key}.runtime`, filePath, errors),
      initialMessages: parseInitialMessages(agentVal["initialMessages"], `agents.${key}.initialMessages`, filePath, errors),
      skills: parseNamedRefs(agentVal["skills"], `agents.${key}.skills`, filePath, errors),
      tools: parseToolRefs(agentVal["tools"], `agents.${key}.tools`, filePath, errors),
      extensions: parseNamedRefs(agentVal["extensions"], `agents.${key}.extensions`, filePath, errors),
      workflowTools: parseWorkflowToolsConfig(agentVal["workflowTools"], filePath, errors),
      workflowOverlay: parseWorkflowOverlay(agentVal["workflowOverlay"], `agents.${key}.workflowOverlay`, filePath, errors),
      mcp: parseMcpRefs(agentVal["mcp"], `agents.${key}.mcp`, filePath, errors),
      permissions: parseOptionalPermissions(agentVal["permissions"], `agents.${key}.permissions`, filePath, errors),
    };
  }

  return Object.keys(agents).length > 0 ? agents : undefined;
}

/** 解析 runtime 配置，当前仅支持 mode / uiProfile。 */
export function parseRuntimeConfig(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): { mode?: string; uiProfile?: string } | undefined {
  if (!isRecord(val)) return undefined;
  const runtime: { mode?: string; uiProfile?: string } = {};
  if (typeof val["mode"] === "string") runtime.mode = val["mode"];
  if (typeof val["uiProfile"] === "string") runtime.uiProfile = val["uiProfile"];
  if (val["mode"] != null && typeof val["mode"] !== "string") {
    errors?.push({ path: filePath ?? "", message: `${field}.mode 必须是字符串` });
  }
  if (val["uiProfile"] != null && typeof val["uiProfile"] !== "string") {
    errors?.push({ path: filePath ?? "", message: `${field}.uiProfile 必须是字符串` });
  }
  return Object.keys(runtime).length > 0 ? runtime : undefined;
}

/** 解析 workflowOverlay，兼容 workflowTools 与 maxWorkflowToolDepth。 */
export function parseWorkflowOverlay(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): { workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>; maxWorkflowToolDepth?: number } | undefined {
  if (!isRecord(val)) return undefined;
  const overlay: { workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>; maxWorkflowToolDepth?: number } = {};
  if (val["workflowTools"] != null) {
    overlay.workflowTools = parseWorkflowToolsConfig(val["workflowTools"], filePath, errors);
  }
  if (typeof val["maxWorkflowToolDepth"] === "number") {
    overlay.maxWorkflowToolDepth = val["maxWorkflowToolDepth"];
  }
  if (val["maxWorkflowToolDepth"] != null && typeof val["maxWorkflowToolDepth"] !== "number") {
    errors?.push({ path: filePath ?? "", message: `${field}.maxWorkflowToolDepth 必须是数字` });
  }
  return Object.keys(overlay).length > 0 ? overlay : undefined;
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
): Array<{ name: string; source?: string; description?: string; type?: string; extension?: string }> | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  const refs: Array<{ name: string; source?: string; description?: string; type?: string; extension?: string }> = [];
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
        type: typeof item.type === "string" ? item.type : undefined,
        extension: typeof item.extension === "string" ? item.extension : undefined,
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

function parseStringList(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): string[] | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是字符串数组` });
    return undefined;
  }
  const items = val.filter((item) => typeof item === "string") as string[];
  if (items.length !== val.length) {
    errors?.push({ path: filePath ?? "", message: `${field} 中所有项都必须是字符串` });
  }
  return items.length > 0 ? items : undefined;
}

function parseInitialMessages(
  val: unknown,
  field: string,
  filePath?: string,
  errors?: TomlLoadError[],
): Array<{ role: "user" | "assistant"; content: string }> | undefined {
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors?.push({ path: filePath ?? "", message: `${field} 必须是数组` });
    return undefined;
  }

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const item of val) {
    if (!isRecord(item) || (item["role"] !== "user" && item["role"] !== "assistant") || typeof item["content"] !== "string") {
      errors?.push({ path: filePath ?? "", message: `${field} 项必须包含 role 与 content 字符串` });
      continue;
    }
    messages.push({ role: item["role"], content: item["content"] });
  }
  return messages.length > 0 ? messages : undefined;
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
