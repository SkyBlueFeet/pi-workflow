const ENV_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)(:-([^}]*))?\}/g;

/**
 * 递归展开工具配置中的环境变量占位符。
 * 仅处理字符串中的 `${NAME}` / `${NAME:-default}` 形式，其余值保持原样。
 */
export function resolveConfigEnvVars(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replaceAll(ENV_PATTERN, (_full, envName: string, _defaultGroup: string | undefined, defaultValue: string | undefined) => {
      const resolved = process.env[envName];
      if (resolved != null && resolved.length > 0) {
        return resolved;
      }
      return defaultValue ?? "";
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveConfigEnvVars(entry));
  }

  if (isRecord(value)) {
    const resolvedEntries = Object.entries(value).map(([key, entry]) => [key, resolveConfigEnvVars(entry)]);
    return Object.fromEntries(resolvedEntries);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
