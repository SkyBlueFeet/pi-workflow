import type { WorkflowDiagnostic } from "../ir/diagnostics.js";

/** DSL 校验和加载过程中所有诊断码的映射表。 */
export const DslDiagnosticCodes = {
  MISSING_ENTRY: "DSL-001",
  DUPLICATE_NODE_ID: "DSL-002",
  INVALID_VALUE_REF_TARGET: "DSL-003",
  INVALID_DEPENDS_ON: "DSL-004",
  MISSING_NODE: "DSL-005",
  CYCLIC_DEPENDENCY: "DSL-006",
  UNSUPPORTED_NODE_KIND: "DSL-007",
  MISSING_CHILDREN_TARGET: "DSL-008",
  INVALID_AGENT_CONFIG: "DSL-009",
  MISSING_EXECUTOR: "DSL-010",
  INVALID_SCHEMA_REF: "DSL-011",
} as const;

/**
 * 创建一条 DSL 诊断信息。
 *
 * @param code 诊断码
 * @param severity 严重级别
 * @param message 诊断描述
 * @param details 附加上下文（路径或节点 ID）
 * @returns 标准化诊断对象
 */
export function createDiagnostic(
  code: string,
  severity: "error" | "warning",
  message: string,
  details?: { path?: string; nodeId?: string },
): WorkflowDiagnostic {
  return { code, severity, message, ...details };
}
