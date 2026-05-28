import type { WorkflowDslDocument, WorkflowDslNode } from "../dsl/types.js";
import type { WorkflowFixResult, WorkflowSuggestedFix } from "./types.js";

/**
 * 当前 fixer 内建支持的建议码。
 */
export const AuthoringFixCodes = {
  REMOVE_UNREACHABLE_NODE: "AUTH-FIX-002",
  REMOVE_EMPTY_COMPOSITE_NODE: "AUTH-FIX-003",
} as const;

/**
 * 按规则执行确定性自动修复，当前仅处理无需猜测的删除类修复。
 */
/** 根据 lint 建议对 DSL 文档执行确定性自动修复（目前仅支持删除类修复）。 */
export class WorkflowFixer {
  /**
   * 对文档应用修复列表，返回应用后文档及执行记录。
   *
   * @param document DSL 文档
   * @param fixes 建议修复列表
   * @returns 修复结果
   */
  apply(document: WorkflowDslDocument, fixes: readonly WorkflowSuggestedFix[]): WorkflowFixResult {
    let current = cloneDocument(document);
    const appliedFixes: WorkflowSuggestedFix[] = [];
    const skippedFixes: WorkflowSuggestedFix[] = [];

    for (const fix of fixes) {
      if (fix.action !== "remove-node" || !fix.nodeId) {
        skippedFixes.push(fix);
        continue;
      }

      if (!isSupportedRemoveFix(fix.code)) {
        skippedFixes.push(fix);
        continue;
      }

      if (!current.nodes.some(node => node.id === fix.nodeId)) {
        skippedFixes.push(fix);
        continue;
      }

      current = removeNode(current, fix.nodeId);
      appliedFixes.push(fix);
    }

    return {
      document: current,
      appliedFixes,
      skippedFixes,
    };
  }
}

function isSupportedRemoveFix(code: string): boolean {
  return code === AuthoringFixCodes.REMOVE_UNREACHABLE_NODE || code === AuthoringFixCodes.REMOVE_EMPTY_COMPOSITE_NODE;
}

/**
 * 便捷函数：对文档应用修复。
 *
 * @param document DSL 文档
 * @param fixes 建议修复列表
 * @returns 修复结果
 */
export function applySuggestedFixes(
  document: WorkflowDslDocument,
  fixes: readonly WorkflowSuggestedFix[],
): WorkflowFixResult {
  return new WorkflowFixer().apply(document, fixes);
}

function cloneDocument(document: WorkflowDslDocument): WorkflowDslDocument {
  return {
    ...document,
    nodes: document.nodes.map(node => ({
      ...node,
      dependsOn: node.dependsOn ? [...node.dependsOn] : undefined,
      children: node.children ? [...node.children] : undefined,
      inputs: node.inputs ? { ...node.inputs } : undefined,
      output: node.output ? { ...node.output } : undefined,
      control: node.control
        ? {
          ...node.control,
          retry: node.control.retry ? { ...node.control.retry } : undefined,
        }
        : undefined,
      executor: {
        ...node.executor,
        config: node.executor.config ? { ...node.executor.config } : undefined,
      },
      capabilities: node.capabilities
        ? {
          ...node.capabilities,
          skills: node.capabilities.skills ? [...node.capabilities.skills] : undefined,
          tools: node.capabilities.tools ? [...node.capabilities.tools] : undefined,
          mcp: node.capabilities.mcp ? [...node.capabilities.mcp] : undefined,
        }
        : undefined,
      missingInput: node.missingInput ? { ...node.missingInput } : undefined,
    })),
    defaults: document.defaults
      ? {
        ...document.defaults,
        executor: document.defaults.executor
          ? {
            ...document.defaults.executor,
            config: document.defaults.executor.config ? { ...document.defaults.executor.config } : undefined,
          }
          : undefined,
        control: document.defaults.control
          ? {
            ...document.defaults.control,
            retry: document.defaults.control.retry ? { ...document.defaults.control.retry } : undefined,
          }
          : undefined,
        missingInput: document.defaults.missingInput ? { ...document.defaults.missingInput } : undefined,
        output: document.defaults.output ? { ...document.defaults.output } : undefined,
      }
      : undefined,
    resources: document.resources ? { ...document.resources, piPackages: document.resources.piPackages ? [...document.resources.piPackages] : undefined } : undefined,
    settings: document.settings ? { ...document.settings } : undefined,
  };
}

function removeNode(document: WorkflowDslDocument, nodeId: string): WorkflowDslDocument {
  const nodes = document.nodes
    .filter(node => node.id !== nodeId)
    .map(node => ({
      ...node,
      dependsOn: node.dependsOn?.filter(dependency => dependency !== nodeId),
      children: node.children?.filter(child => child !== nodeId),
    }));

  const nextEntry = document.entry === nodeId ? resolveFallbackEntry(nodes) : document.entry;
  return {
    ...document,
    entry: nextEntry,
    nodes,
  };
}

function resolveFallbackEntry(nodes: readonly WorkflowDslNode[]): string {
  if (nodes.length === 0) {
    return "";
  }

  const ids = new Set(nodes.map(node => node.id));
  const hasIncoming = new Set<string>();
  for (const node of nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (ids.has(dependency)) {
        hasIncoming.add(node.id);
      }
    }
  }

  const root = nodes.find(node => !hasIncoming.has(node.id));
  return root?.id ?? nodes[0].id;
}
