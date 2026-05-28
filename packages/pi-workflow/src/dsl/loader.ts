import type { WorkflowDslDocument } from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { validateSchema } from "./schema.js";
import { validateReferences } from "./validator.js";

/** DSL 加载的结果：文档与诊断列表。 */
export interface DslLoadResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

/**
 * 将原始对象加载为 DSL 文档并执行校验。
 * 先做 Schema 校验，通过后再做引用校验。
 *
 * @param input 原始对象（来自 JSON 解析）
 * @returns 加载结果（文档 + 诊断）
 */
export function loadFromObject(input: Record<string, unknown>): DslLoadResult {
  const doc = input as unknown as WorkflowDslDocument;
  const diagnostics: WorkflowDiagnostic[] = [];

  const schemaDiags = validateSchema(doc);
  diagnostics.push(...schemaDiags);

  if (!schemaDiags.some(d => d.severity === "error")) {
    const refDiags = validateReferences(doc);
    diagnostics.push(...refDiags);
  }

  return { document: doc, diagnostics };
}
