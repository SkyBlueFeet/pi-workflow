import type { WorkflowConfig } from "./types.js";
import type { WorkflowSecurityConfig } from "../security/types.js";

/** 默认安全配置：拒绝模式、空权限列表、仅记录拒绝事件。 */
export const DEFAULT_SECURITY_CONFIG: WorkflowSecurityConfig = {
  defaultMode: "deny",
  permissions: [],
  audit: {
    enabled: true,
    includeAllowDecisions: false,
    includeDenyDecisions: true,
  },
};

/** 默认工作流配置：空模型、空节点、空执行器及默认安全配置。 */
export const defaultWorkflowConfig: WorkflowConfig = {
  model: {},
  nodes: {},
  executor: {},
  security: DEFAULT_SECURITY_CONFIG,
};
