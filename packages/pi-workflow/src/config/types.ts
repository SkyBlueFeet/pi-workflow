import type { WorkflowRetryPolicy } from "../ir/types.js";
import type { WorkflowSecurityConfig } from "../security/types.js";

/** 模型配置，定义工作流使用的 LLM 提供商、模型名及生成参数。 */
export interface ModelConfig {
  provider?: string;
  model?: string;
  variant?: string;
  temperature?: number;
  maxTokens?: number;
}

/** 节点级配置，目前支持节点级模型覆盖。 */
export interface NodeConfig {
  model?: ModelConfig;
}

/** 执行器配置，控制超时、重试策略及工作流工具嵌套深度。 */
export interface ExecutorConfig {
  timeoutMs?: number;
  retry?: Partial<WorkflowRetryPolicy>;
  maxWorkflowToolDepth?: number;
}

import type { AgentDefinition, WorkflowToolDefinition } from "../agents/types.js";

/**
 * 完整的工作流配置，可由 TOML / JSON 配置文件反序列化得到。
 * 包含模型、节点、执行器、包、智能体、工作流工具及安全策略。
 */
export interface WorkflowConfig {
  model?: ModelConfig;
  nodes?: Record<string, NodeConfig>;
  executor?: ExecutorConfig;
  baseDir?: string;
  packages?: Record<string, string>;
  agents?: Record<string, Omit<AgentDefinition, "id">>;
  workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
  security?: WorkflowSecurityConfig;
}

/** 配置校验单条错误，指明出错的节点、字段及具体信息。 */
export interface ConfigValidationError {
  nodeId: string;
  field: string;
  message: string;
}

/** 配置校验结果，valid 为 false 时 errors 包含所有发现的问题。 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}
