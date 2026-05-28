import type { WorkflowDslDocument } from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { DslDiagnosticCodes, createDiagnostic } from "./diagnostics.js";

/**
 * 当前 loader 正式支持的 DSL schema 标识。
 */
export const WORKFLOW_DSL_SCHEMA_URI = "urn:pi-workflow:dsl:v1";

/**
 * 校验 DSL 文档的 Schema 完整性（必填字段、节点 ID 唯一性）。
 *
 * @param doc 待校验的 DSL 文档
 * @returns 校验诊断列表
 */
export function validateSchema(doc: WorkflowDslDocument): readonly WorkflowDiagnostic[] {
  const result: WorkflowDiagnostic[] = [];

  validateSchemaRef(doc, result);

  if (!doc.id || typeof doc.id !== "string") {
    result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "文档 id 为必填项"));
  }
  if (!doc.version || typeof doc.version !== "string") {
    result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "文档 version 为必填项"));
  }
  if (!doc.title || typeof doc.title !== "string") {
    result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "文档 title 为必填项"));
  }
  if (!doc.entry || typeof doc.entry !== "string") {
    result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "文档 entry 为必填项"));
  }
  if (!Array.isArray(doc.nodes) || doc.nodes.length === 0) {
    result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "nodes 不能为空"));
    return result;
  }

  const ids = new Set<string>();
  for (const node of doc.nodes) {
    if (!node.id || typeof node.id !== "string") {
      result.push(createDiagnostic(DslDiagnosticCodes.MISSING_ENTRY, "error", "节点缺少 id 字段"));
      continue;
    }
    if (ids.has(node.id)) {
      result.push(createDiagnostic(
        DslDiagnosticCodes.DUPLICATE_NODE_ID,
        "error",
        `重复的节点 id: ${node.id}`,
        { nodeId: node.id },
      ));
    }
    ids.add(node.id);
  }

  return result;
}

function validateSchemaRef(doc: WorkflowDslDocument, result: WorkflowDiagnostic[]): void {
  if (!("$schema" in doc) || doc.$schema === undefined) {
    return;
  }

  if (typeof doc.$schema !== "string") {
    result.push(createDiagnostic(
      DslDiagnosticCodes.INVALID_SCHEMA_REF,
      "error",
      "文档 $schema 必须是字符串",
      { path: "$schema" },
    ));
    return;
  }

  if (doc.$schema !== WORKFLOW_DSL_SCHEMA_URI) {
    result.push(createDiagnostic(
      DslDiagnosticCodes.INVALID_SCHEMA_REF,
      "error",
      `不支持的 $schema: ${doc.$schema}，当前仅支持 ${WORKFLOW_DSL_SCHEMA_URI}`,
      { path: "$schema" },
    ));
  }
}
