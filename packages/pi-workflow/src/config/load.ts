import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getConfiguredWorkflowPackages } from "@pi-workflow/pi-package-adapter";
import type { WorkflowConfig } from "./types.js";
import { loadTomlConfig } from "./toml-loader.js";

/**
 * 统一加载 TOML 或 JSON 格式的工作流配置文件。
 * 自动识别文件后缀，加载后合并已安装的 PI 包声明。
 *
 * @param configPath 配置文件路径（绝对或相对）
 * @param cwd 相对路径解析的基准目录，默认当前工作目录
 * @returns 解析后的配置对象及基准目录
 * @throws 配置文件不存在或格式错误时抛出
 */
export function loadWorkflowConfigFile(configPath: string, cwd: string = process.cwd()): { config: WorkflowConfig; baseDir: string } {
  const absolutePath = resolve(configPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }

  const baseDir = dirname(absolutePath);
  if (absolutePath.endsWith(".toml")) {
    const loadedConfig = loadTomlConfig(absolutePath);
    return {
      config: mergeConfiguredPackages(loadedConfig, cwd),
      baseDir,
    };
  }

  const loadedConfig = JSON.parse(readFileSync(absolutePath, "utf-8")) as WorkflowConfig;
  return {
    config: mergeConfiguredPackages(loadedConfig, cwd),
    baseDir,
  };
}

/** 将已安装的 PI 包声明合并到配置中，用户显式声明的包优先级更高。 */
function mergeConfiguredPackages(config: WorkflowConfig, cwd: string): WorkflowConfig {
  const configuredPackages = getConfiguredWorkflowPackages(cwd);
  if (Object.keys(configuredPackages).length === 0) {
    return config;
  }

  return {
    ...config,
    packages: {
      ...configuredPackages,
      ...config.packages,
    },
  };
}
