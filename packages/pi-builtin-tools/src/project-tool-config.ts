import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";
import { BUILTIN_TOOLS_PACKAGE_NAME, parseBuiltinToolsConfig } from "./tool-config.js";
import type { BuiltinToolsPackageConfig } from "./types.js";

const TOOL_CONFIG_FILE = "tool-config.toml";

interface ProjectToolConfigFile {
  readonly tool?: Record<string, unknown>;
}

/**
 * 从项目 `.pi-workflow/tool-config.toml` 读取指定包的工具配置。
 * 文件不存在、TOML 非法或未声明当前包时，统一回退为空配置。
 */
export function loadBuiltinToolsProjectConfig(cwd?: string): BuiltinToolsPackageConfig {
  const configPath = resolve(cwd ?? process.cwd(), ".pi-workflow", TOOL_CONFIG_FILE);
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parse(raw) as ProjectToolConfigFile;
    return parseBuiltinToolsConfig(parsed.tool?.[BUILTIN_TOOLS_PACKAGE_NAME]);
  } catch {
    return {};
  }
}
