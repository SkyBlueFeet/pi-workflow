import type { WorkflowNodeIR } from "../ir/types.js";
import type { ModelConfig, WorkflowConfig } from "./types.js";
import type { WorkflowSecurityConfig } from "../security/types.js";
import { defaultWorkflowConfig, DEFAULT_SECURITY_CONFIG } from "./defaults.js";

/**
 * 合并默认安全配置与用户配置的 security 段。
 * 权限和审计选项使用深层合并，用户配置优先。
 *
 * @param config 工作流配置（可选）
 * @returns 合并后的安全配置
 */
export function resolveSecurityConfig(config?: WorkflowConfig): WorkflowSecurityConfig {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    ...config?.security,
    permissions: config?.security?.permissions ?? DEFAULT_SECURITY_CONFIG.permissions,
    audit: {
      ...DEFAULT_SECURITY_CONFIG.audit,
      ...config?.security?.audit,
    },
  };
}

/**
 * 解析某节点的最终模型配置：全局模型 → 节点覆盖 → 节点级 model 覆盖。
 * 三层合并策略确保配置优先级正确。
 *
 * @param node 工作流节点 IR
 * @param config 工作流配置（可选）
 * @returns 该节点生效的模型配置
 */
export function resolveModelConfig(
  node: WorkflowNodeIR,
  config?: WorkflowConfig,
): ModelConfig {
  const merged: WorkflowConfig = {
    ...defaultWorkflowConfig,
    ...config,
    model: { ...defaultWorkflowConfig.model, ...config?.model },
    nodes: { ...defaultWorkflowConfig.nodes, ...config?.nodes },
    executor: { ...defaultWorkflowConfig.executor, ...config?.executor },
  };

  const nodeOverride = merged.nodes?.[node.id]?.model;

  return {
    ...merged.model,
    ...nodeOverride,
  };
}

/** 判断模型配置是否已指定 provider 和 model 两个必需字段。 */
export function isModelConfigured(modelConfig: ModelConfig): boolean {
  return !!(modelConfig.provider && modelConfig.model);
}

/**
 * 将模型配置格式化为 `provider/model` 字符串。
 * provider 或 model 缺失时返回 undefined。
 */
export function formatModelString(modelConfig: ModelConfig): string | undefined {
  if (!modelConfig.provider || !modelConfig.model) return undefined;
  return `${modelConfig.provider}/${modelConfig.model}`;
}
