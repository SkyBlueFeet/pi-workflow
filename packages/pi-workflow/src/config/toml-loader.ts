import { parse } from "smol-toml";
import { readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { WorkflowConfig } from "./types.js";
import {
  parseModelConfig,
  parseNodesConfig,
  parseExecutorConfig,
  parsePackagesConfig,
  parseAgentsConfig,
  parseWorkflowToolsConfig,
} from "./toml-section-parsers.js";
import { parseSecurityConfig } from "./toml-security-parsers.js";

/** TOML 解析错误详情，包含文件路径、行列位置与原始信息。 */
export interface TomlLoadError {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  readonly raw?: string;
}

/**
 * 读取并解析 TOML 格式的工作流配置文件。
 * 文件不存在或解析失败时抛出 TomlConfigError，内附详细错误列表。
 *
 * @param filePath TOML 文件绝对或相对路径
 * @returns 解析后的 WorkflowConfig
 */
export function loadTomlConfig(filePath: string): WorkflowConfig {
  if (!existsSync(filePath)) {
    throw new TomlConfigError([{ path: filePath, message: `配置文件不存在: ${filePath}` }]);
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new TomlConfigError([{ path: filePath, message: `读取配置文件失败: ${String(err)}` }]);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parse(raw) as Record<string, unknown>;
  } catch (err) {
    const msg = String(err);
    const lineMatch = msg.match(/line\s+(\d+)/i);
    const colMatch = msg.match(/column\s+(\d+)/i);
    throw new TomlConfigError([{
      path: filePath,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
      column: colMatch ? Number(colMatch[1]) : undefined,
      message: `TOML 解析错误: ${msg}`,
      raw: msg,
    }]);
  }

  return tomlToWorkflowConfig(parsed, filePath);
}

/**
 * 将已解析的 TOML 对象映射为 WorkflowConfig。
 * 依次处理 model / nodes / executor / packages / agents / workflowTools / security 各段，
 * 每段解析出错时收集到 errors 数组，最后统一抛出。
 *
 * @param toml TOML 解析后的原始对象
 * @param filePath 源文件路径（用于错误信息）
 * @returns 映射后的 WorkflowConfig
 * @throws TomlConfigError 任意段解析出错时抛出
 */
export function tomlToWorkflowConfig(toml: Record<string, unknown>, filePath?: string): WorkflowConfig {
  const errors: TomlLoadError[] = [];
  const config: WorkflowConfig = {
    baseDir: filePath ? dirname(filePath) : undefined,
  };

  if (toml["model"] != null) {
    config.model = parseModelConfig(toml["model"], filePath, errors);
  }

  if (toml["nodes"] != null) {
    config.nodes = parseNodesConfig(toml["nodes"], filePath, errors);
  }

  if (toml["executor"] != null) {
    config.executor = parseExecutorConfig(toml["executor"], filePath, errors);
  }

  if (toml["packages"] != null) {
    config.packages = parsePackagesConfig(toml["packages"], filePath, errors);
  }

  if (toml["agents"] != null) {
    config.agents = parseAgentsConfig(toml["agents"], filePath, errors);
  }

  if (toml["workflowTools"] != null) {
    config.workflowTools = parseWorkflowToolsConfig(toml["workflowTools"], filePath, errors);
  }

  if (toml["security"] != null) {
    config.security = parseSecurityConfig(toml["security"], filePath, errors);
  }

  if (errors.length > 0) {
    throw new TomlConfigError(errors);
  }

  return config;
}

/**
 * TOML 配置错误聚合异常，包含一个或多个解析/校验错误。
 * 当配置文件中存在多个问题时，一次性收集所有错误后抛出。
 */
export class TomlConfigError extends Error {
  readonly errors: TomlLoadError[];
  constructor(errors: TomlLoadError[]) {
    const msg = errors.map((e) => `${e.path}:${e.line ?? ""}:${e.column ?? ""} ${e.message}`).join("; ");
    super(`TOML 配置错误: ${msg}`);
    this.name = "TomlConfigError";
    this.errors = errors;
  }
}
