import type { WorkflowDiagnostic } from "../../ir/diagnostics.js";
import { dslToIr } from "../../dsl/mapper.js";
import {
  type WorkflowDefineImportResult,
  type WorkflowDefineIrImportResult,
} from "./types.js";
import { importDocument } from "./importer-helpers.js";

/**
 * 将最小可识别的 WorkflowDefine 旧格式转换为当前 pi-native DSL。
 *
 * 当前实现优先覆盖 `manual/workflow/return` 主链路；无法映射的节点类型与
 * 旧引擎字段通过 diagnostics 暴露，不强行伪造执行语义。
 */
export function importWorkflowDefine(input: Record<string, unknown>): WorkflowDefineImportResult {
  const diagnostics: WorkflowDiagnostic[] = [];
  const document = importDocument(input, diagnostics);
  return { document, diagnostics };
}

/**
 * 将 WorkflowDefine 直接导入为 DSL 与 IR，便于复用现有 runtime 链路验证。
 */
export function importWorkflowDefineToIr(input: Record<string, unknown>): WorkflowDefineIrImportResult {
  const result = importWorkflowDefine(input);
  return {
    ...result,
    ir: dslToIr(result.document),
  };
}
