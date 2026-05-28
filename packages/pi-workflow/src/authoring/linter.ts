import { loadFromDirectory } from "../dsl/directory-loader.js";
import { loadFromObject } from "../dsl/loader.js";
import type { WorkflowDslDocument, WorkflowDslNode } from "../dsl/types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { WorkflowLintResult, WorkflowSuggestedFix } from "./types.js";

/**
 * authoring 层当前内建的静态诊断码。
 */
export const AuthoringDiagnosticCodes = {
  UNREACHABLE_NODE: "AUTH-001",
  EMPTY_CHILDREN: "AUTH-002",
  MISSING_INPUT_POLICY: "AUTH-003",
} as const;

/**
 * 对 workflow 草案执行确定性静态检查，不依赖外部宿主或模型能力。
 */
/**
 * 对 workflow DSL 执行确定性静态检查（节点可达性、复合节点完整性、输入策略），
 * 不依赖外部模型能力。
 */
export class WorkflowLinter {
  /**
   * 对原始 JSON 对象执行 lint。
   *
   * @param input 原始对象
   * @returns lint 结果
   */
  lintObject(input: Record<string, unknown>): WorkflowLintResult {
    const { document, diagnostics } = loadFromObject(input);
    return buildLintResult(document, diagnostics);
  }

  /**
   * 对工作流目录执行 lint。
   *
   * @param workflowDir 工作流目录路径
   * @returns lint 结果
   */
  lintDirectory(workflowDir: string): WorkflowLintResult {
    const { document, diagnostics } = loadFromDirectory(workflowDir);
    return buildLintResult(document, diagnostics);
  }
}

/**
 * 便捷函数：对原始对象执行 lint。
 *
 * @param input 原始对象
 * @returns lint 结果
 */
export function lintWorkflowObject(input: Record<string, unknown>): WorkflowLintResult {
  return new WorkflowLinter().lintObject(input);
}

/**
 * 便捷函数：对工作流目录执行 lint。
 *
 * @param workflowDir 工作流目录路径
 * @returns lint 结果
 */
export function lintWorkflowDirectory(workflowDir: string): WorkflowLintResult {
  return new WorkflowLinter().lintDirectory(workflowDir);
}

function buildLintResult(
  document: WorkflowDslDocument,
  baseDiagnostics: readonly WorkflowDiagnostic[],
): WorkflowLintResult {
  const diagnostics = [...baseDiagnostics];
  if (!hasBlockingError(baseDiagnostics)) {
    diagnostics.push(...collectEmptyChildrenDiagnostics(document));
    diagnostics.push(...collectMissingInputPolicyDiagnostics(document));
    diagnostics.push(...collectReachabilityDiagnostics(document));
  }

  return {
    document,
    diagnostics,
    suggestedFixes: createSuggestedFixes(diagnostics),
  };
}

function collectEmptyChildrenDiagnostics(doc: WorkflowDslDocument): WorkflowDiagnostic[] {
  return doc.nodes.flatMap((node, index) => {
    if (!isCompositeNode(node.executor.type)) {
      return [];
    }

    if ((node.children?.length ?? 0) > 0) {
      return [];
    }

    return [{
      code: AuthoringDiagnosticCodes.EMPTY_CHILDREN,
      severity: "warning" as const,
      message: `复合节点 "${node.id}" 未声明任何 children，运行时不会产生有效子流程`,
      nodeId: node.id,
      path: `nodes[${index}].children`,
    }];
  });
}

function collectMissingInputPolicyDiagnostics(doc: WorkflowDslDocument): WorkflowDiagnostic[] {
  return doc.nodes.flatMap((node, index) => {
    if (!requiresExplicitInputPolicy(node.executor.type)) {
      return [];
    }

    const hasInputs = !!node.inputs && Object.keys(node.inputs).length > 0;
    if (hasInputs || node.missingInput) {
      return [];
    }

    return [{
      code: AuthoringDiagnosticCodes.MISSING_INPUT_POLICY,
      severity: "warning" as const,
      message: `节点 "${node.id}" 没有 inputs，且未声明 missingInput 策略`,
      nodeId: node.id,
      path: `nodes[${index}].missingInput`,
    }];
  });
}

function hasBlockingError(diagnostics: readonly WorkflowDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === "error");
}

function collectReachabilityDiagnostics(doc: WorkflowDslDocument): WorkflowDiagnostic[] {
  if (!doc.entry) {
    return [];
  }

  const nodeMap = new Map(doc.nodes.map(node => [node.id, node]));
  if (!nodeMap.has(doc.entry)) {
    return [];
  }

  const adjacency = buildReachabilityMap(doc.nodes);
  const visited = new Set<string>();
  const queue = [doc.entry];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return doc.nodes.flatMap((node, index) => {
    if (visited.has(node.id)) {
      return [];
    }
    return [{
      code: AuthoringDiagnosticCodes.UNREACHABLE_NODE,
      severity: "warning" as const,
      message: `节点 "${node.id}" 从入口 "${doc.entry}" 不可达`,
      nodeId: node.id,
      path: `nodes[${index}]`,
    }];
  });
}

function buildReachabilityMap(nodes: readonly WorkflowDslNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of nodes) {
    ensureEntry(map, node.id);

    for (const dependency of node.dependsOn ?? []) {
      ensureEntry(map, dependency).push(node.id);
    }

    for (const child of node.children ?? []) {
      ensureEntry(map, node.id).push(child);
    }
  }
  return map;
}

function ensureEntry(map: Map<string, string[]>, nodeId: string): string[] {
  const existing = map.get(nodeId);
  if (existing) {
    return existing;
  }

  const created: string[] = [];
  map.set(nodeId, created);
  return created;
}

function createSuggestedFixes(diagnostics: readonly WorkflowDiagnostic[]): WorkflowSuggestedFix[] {
  return diagnostics.flatMap(diagnostic => {
    if (!diagnostic.nodeId) {
      return [];
    }

    if (diagnostic.code === AuthoringDiagnosticCodes.EMPTY_CHILDREN) {
      return [{
        code: "AUTH-FIX-003",
        action: "remove-node" as const,
        description: `删除空的复合节点 "${diagnostic.nodeId}"，或后续补上 children 后再保留`,
        nodeId: diagnostic.nodeId,
        path: diagnostic.path,
      }];
    }

    if (diagnostic.code !== AuthoringDiagnosticCodes.UNREACHABLE_NODE) {
      return [];
    }

    return [
      {
        code: "AUTH-FIX-001",
        action: "connect-node" as const,
        description: `将节点 "${diagnostic.nodeId}" 连接到入口链路或某个可达节点之后`,
        nodeId: diagnostic.nodeId,
        path: diagnostic.path,
      },
      {
        code: "AUTH-FIX-002",
        action: "remove-node" as const,
        description: `如果节点 "${diagnostic.nodeId}" 已废弃，则直接删除它`,
        nodeId: diagnostic.nodeId,
        path: diagnostic.path,
      },
    ];
  });
}

function isCompositeNode(kind: WorkflowDslNode["executor"]["type"]): boolean {
  return kind === "workflow" || kind === "if" || kind === "parallel" || kind === "loop";
}

function requiresExplicitInputPolicy(kind: WorkflowDslNode["executor"]["type"]): boolean {
  return kind === "manual" || kind === "agent" || kind === "tool" || kind === "http";
}
