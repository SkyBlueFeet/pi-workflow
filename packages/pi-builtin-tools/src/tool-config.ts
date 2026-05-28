import type { BuiltinToolsPackageConfig, ToolProviderConfig } from "./types.js";
import type { ProviderName } from "./tools/web-search.js";
import { resolveConfigEnvVars } from "./tool-config-env.js";

export const BUILTIN_TOOLS_PACKAGE_NAME = "@pi-workflow/builtin-tools";

/**
 * 将通用 tool[packageName] 原始配置收敛为 builtin-tools 自己的配置对象。
 */
export function parseBuiltinToolsConfig(value: unknown): BuiltinToolsPackageConfig {
  const resolvedValue = resolveConfigEnvVars(value);
  if (!isRecord(resolvedValue)) {
    return {};
  }

  return {
    webSearch: parseWebSearchConfig(resolvedValue["webSearch"]),
    webFetch: parseWebFetchConfig(resolvedValue["webFetch"]),
    net: parseNetConfig(resolvedValue["net"]),
  };
}

export function resolveProviderConfig(
  config: BuiltinToolsPackageConfig,
  provider: ProviderName,
): ToolProviderConfig | undefined {
  return config.webSearch?.providers?.[provider];
}

function parseWebSearchConfig(value: unknown): BuiltinToolsPackageConfig["webSearch"] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    provider: isProviderName(value["provider"]) ? value["provider"] : undefined,
    defaults: isRecord(value["defaults"]) ? {
      maxResults: typeof value["defaults"]["maxResults"] === "number" ? value["defaults"]["maxResults"] : undefined,
    } : undefined,
    providers: isRecord(value["providers"]) ? parseProvidersConfig(value["providers"]) : undefined,
  };
}

function parseWebFetchConfig(value: unknown): BuiltinToolsPackageConfig["webFetch"] {
  if (!isRecord(value) || !isRecord(value["defaults"])) {
    return undefined;
  }

  return {
    defaults: {
      timeout: typeof value["defaults"]["timeout"] === "number" ? value["defaults"]["timeout"] : undefined,
      raw: typeof value["defaults"]["raw"] === "boolean" ? value["defaults"]["raw"] : undefined,
      format: isFetchFormat(value["defaults"]["format"]) ? value["defaults"]["format"] : undefined,
    },
  };
}

function parseNetConfig(value: unknown): BuiltinToolsPackageConfig["net"] {
  if (!isRecord(value) || !isRecord(value["defaults"])) {
    return undefined;
  }

  return {
    defaults: {
      timeoutSeconds: typeof value["defaults"]["timeoutSeconds"] === "number" ? value["defaults"]["timeoutSeconds"] : undefined,
      maxResponseBytes: typeof value["defaults"]["maxResponseBytes"] === "number" ? value["defaults"]["maxResponseBytes"] : undefined,
      responseFormat: isResponseFormat(value["defaults"]["responseFormat"]) ? value["defaults"]["responseFormat"] : undefined,
      redirect: isRedirectMode(value["defaults"]["redirect"]) ? value["defaults"]["redirect"] : undefined,
      maxRedirects: typeof value["defaults"]["maxRedirects"] === "number" ? value["defaults"]["maxRedirects"] : undefined,
    },
  };
}

function parseProvidersConfig(value: Record<string, unknown>): Partial<Record<ProviderName, ToolProviderConfig>> {
  const providers: Partial<Record<ProviderName, ToolProviderConfig>> = {};
  for (const provider of ["brave", "tavily", "serper", "exa"] as const) {
    const parsed = parseProviderConfig(value[provider]);
    if (parsed) {
      providers[provider] = parsed;
    }
  }
  return providers;
}

function parseProviderConfig(value: unknown): ToolProviderConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    apiKey: typeof value["apiKey"] === "string" ? value["apiKey"] : undefined,
    baseUrl: typeof value["baseUrl"] === "string" ? value["baseUrl"] : undefined,
    enabled: typeof value["enabled"] === "boolean" ? value["enabled"] : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProviderName(value: unknown): value is ProviderName {
  return value === "brave" || value === "tavily" || value === "serper" || value === "exa";
}

function isFetchFormat(value: unknown): value is "markdown" | "text" | "html" {
  return value === "markdown" || value === "text" || value === "html";
}

function isResponseFormat(value: unknown): value is "auto" | "text" | "base64" {
  return value === "auto" || value === "text" || value === "base64";
}

function isRedirectMode(value: unknown): value is "follow" | "manual" | "error" {
  return value === "follow" || value === "manual" || value === "error";
}
