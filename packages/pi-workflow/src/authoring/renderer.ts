import { dslToIr } from "../dsl/mapper.js";
import type { WorkflowDslDocument } from "../dsl/types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { WorkflowRenderResult } from "./types.js";

/**
 * 将 workflow 文档渲染为稳定的文本摘要，便于 authoring 阶段快速审阅。
 */
/** 将 workflow 文档渲染为人类可读的文本摘要。 */
export class WorkflowRenderer {
  /**
   * 渲染文档为摘要文本。
   *
   * @param document DSL 文档
   * @param diagnostics 诊断列表（可选）
   * @returns 渲染结果
   */
  render(document: WorkflowDslDocument, diagnostics: readonly WorkflowDiagnostic[] = []): WorkflowRenderResult {
    const ir = dslToIr(document);
    const counts = countNodeKinds(document);
    const lines: string[] = [
      `Workflow: ${document.title} (${document.id})`,
      `Version: ${document.version}`,
      `Entry: ${document.entry || "<missing>"}`,
      `Nodes: ${document.nodes.length}`,
      `Edges: ${ir.edges.length}`,
      `Kinds: ${formatKindCounts(counts)}`,
      `Order: ${renderExecutionOrder(document)}`,
    ];

    if (diagnostics.length > 0) {
      lines.push(`Diagnostics: ${renderDiagnosticCounts(diagnostics)}`);
    }

    lines.push("Node Details:");
    for (const node of document.nodes) {
      lines.push(renderNodeLine(node));
    }

    return {
      summary: lines.join("\n"),
      lines,
    };
  }
}

/**
 * 便捷函数：生成 workflow 文本摘要。
 *
 * @param document DSL 文档
 * @param diagnostics 诊断列表（可选）
 * @returns 渲染结果
 */
export function renderWorkflowSummary(
  document: WorkflowDslDocument,
  diagnostics: readonly WorkflowDiagnostic[] = [],
): WorkflowRenderResult {
  return new WorkflowRenderer().render(document, diagnostics);
}

function countNodeKinds(document: WorkflowDslDocument): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of document.nodes) {
    counts.set(node.executor.type, (counts.get(node.executor.type) ?? 0) + 1);
  }
  return counts;
}

function formatKindCounts(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}=${count}`)
    .join(", ");
}

function renderExecutionOrder(document: WorkflowDslDocument): string {
  const nodeIds = new Set(document.nodes.map(node => node.id));
  const hasIncoming = new Set<string>();
  for (const node of document.nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (nodeIds.has(dependency)) {
        hasIncoming.add(node.id);
      }
    }
  }

  const roots = document.nodes
    .filter(node => !hasIncoming.has(node.id))
    .map(node => node.id);

  return roots.length > 0 ? roots.join(" -> ") : "<unresolved>";
}

function renderDiagnosticCounts(diagnostics: readonly WorkflowDiagnostic[]): string {
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === "error").length;
  const warnings = diagnostics.filter(diagnostic => diagnostic.severity === "warning").length;
  return `errors=${errors}, warnings=${warnings}`;
}

function renderNodeLine(node: WorkflowDslDocument["nodes"][number]): string {
  const deps = node.dependsOn && node.dependsOn.length > 0 ? node.dependsOn.join(", ") : "-";
  const children = node.children && node.children.length > 0 ? node.children.join(", ") : "-";
  return `- ${node.id} [${node.executor.type}] deps=${deps} children=${children}`;
}
