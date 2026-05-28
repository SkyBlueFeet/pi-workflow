import type { WorkflowDiagnostic } from "../../ir/diagnostics.js";
import type { WorkflowDefinitionIR } from "../../ir/types.js";
import type { WorkflowDslDocument } from "../../dsl/types.js";

/**
 * WorkflowDefine 旧格式的最小导入结果。
 *
 * document 始终返回当前可映射的 pi-native DSL；diagnostics 用于指出
 * 无法直接迁移的字段、节点类型或引用问题。
 */
export interface WorkflowDefineImportResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

/**
 * WorkflowDefine 导入后直接产出 IR 的便捷结果。
 */
export interface WorkflowDefineIrImportResult extends WorkflowDefineImportResult {
  readonly ir: WorkflowDefinitionIR;
}

/** WorkflowDefine 导入过程中使用的诊断码映射表。 */
export const WorkflowDefineDiagnosticCodes = {
  INVALID_DOCUMENT: "WFD-001",
  MISSING_STEP_ID: "WFD-002",
  UNSUPPORTED_STEP_TYPE: "WFD-003",
  UNSUPPORTED_FIELD: "WFD-004",
  INVALID_REFERENCE: "WFD-005",
} as const;
