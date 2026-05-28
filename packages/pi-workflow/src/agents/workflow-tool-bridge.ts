import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { WorkflowDefinitionIR } from "../ir/types.js";
import { loadFromObject, loadFromDirectory, dslToIr } from "../dsl/index.js";
import type { WorkflowConfig } from "../config/types.js";
import type { WorkflowToolDefinition, ResolvedAgentConfig } from "./types.js";

/** 已解析的工作流工具：名称、描述及完整 IR。 */
export interface ResolvedWorkflowTool {
  readonly name: string;
  readonly description?: string;
  readonly workflow: WorkflowDefinitionIR;
  readonly inputSchema?: Record<string, unknown>;
  readonly permissions?: WorkflowToolDefinition["permissions"];
}

/** 工作流工具桥接的解析结果，包含成功工具与失败错误。 */
export interface WorkflowToolBridgeResult {
  readonly tools: ResolvedWorkflowTool[];
  readonly errors: WorkflowToolBridgeError[];
}

/** 工作流工具解析过程中的错误信息。 */
export interface WorkflowToolBridgeError {
  readonly name: string;
  readonly message: string;
}

/**
 * 从已解析的 Agent 配置中解析所有工作流工具。
 * 支持内联 IR 和文件路径两种方式加载工作流定义。
 *
 * @param resolvedConfig 已合并的 Agent 配置
 * @param config 全局工作流配置
 * @param cwd 工作目录（用于解析相对路径，默认使用 config.baseDir）
 * @returns 解析结果（成功工具 + 错误列表）
 */
export function resolveWorkflowTools(
  resolvedConfig: ResolvedAgentConfig,
  config: WorkflowConfig,
  cwd?: string,
): WorkflowToolBridgeResult {
  const tools: ResolvedWorkflowTool[] = [];
  const errors: WorkflowToolBridgeError[] = [];

  for (const [name, def] of Object.entries(resolvedConfig.workflowTools)) {
    try {
      const resolved = resolveSingleWorkflowTool(name, def, cwd ?? config.baseDir);
      if (resolved) {
        tools.push(resolved);
      }
    } catch (err) {
      errors.push({ name, message: String(err) });
    }
  }

  return { tools, errors };
}

function resolveSingleWorkflowTool(
  name: string,
  def: WorkflowToolDefinition,
  cwd?: string,
): ResolvedWorkflowTool | undefined {
  if (def.workflow) {
    return {
      name,
      description: def.description,
      workflow: def.workflow,
      inputSchema: def.inputSchema,
      permissions: def.permissions,
    };
  }

  if (def.workflowPath) {
    const absPath = resolve(cwd ?? process.cwd(), def.workflowPath);
    if (!existsSync(absPath)) {
      throw new Error(`工作流路径不存在: ${def.workflowPath}`);
    }

    const workflow = loadWorkflowDefinition(absPath);
    return {
      name,
      description: def.description,
      workflow,
      inputSchema: def.inputSchema,
      permissions: def.permissions,
    };
  }

  throw new Error(`工作流工具 "${name}" 缺少 workflowPath 或 workflow 定义`);
}

function loadWorkflowDefinition(workflowPath: string): WorkflowDefinitionIR {
  const stat = statSync(workflowPath);

  if (stat.isDirectory()) {
    const dirResult = loadFromDirectory(workflowPath);
    return dslToIr(dirResult.document);
  }

  if (stat.isFile()) {
    const raw = readFileSync(workflowPath, "utf-8");
    const obj = JSON.parse(raw);
    const docResult = loadFromObject(obj);
    return dslToIr(docResult.document);
  }

  throw new Error(`无法加载工作流定义: ${workflowPath}`);
}
