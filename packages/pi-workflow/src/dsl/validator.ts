import type { WorkflowDslDocument, WorkflowDslNode } from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { DslDiagnosticCodes, createDiagnostic } from "./diagnostics.js";

/**
 * 校验 DSL 文档中的引用完整性（节点存在性、依赖关系、agent 配置）。
 *
 * @param doc 待校验的 DSL 文档
 * @returns 引用校验诊断列表
 */
export function validateReferences(doc: WorkflowDslDocument): readonly WorkflowDiagnostic[] {
  const result: WorkflowDiagnostic[] = [];
  const nodeIds = new Set(doc.nodes.map(n => n.id));

  if (doc.entry && !nodeIds.has(doc.entry)) {
    result.push(createDiagnostic(
      DslDiagnosticCodes.MISSING_NODE,
      "error",
      `entry 节点 "${doc.entry}" 在 nodes 中不存在`,
    ));
  }

  const seenExecutors = new Set<string>();
  for (const node of doc.nodes) {
    if (!node.executor) {
      result.push(createDiagnostic(
        DslDiagnosticCodes.MISSING_EXECUTOR,
        "error",
        `节点 "${node.id}" 缺少 executor 定义`,
        { nodeId: node.id },
      ));
      continue;
    }
    if (seenExecutors.has(node.id)) continue;
    seenExecutors.add(node.id);
    validateNodeRefs(node, nodeIds, result);
  }

  return result;
}

function validateNodeRefs(
  node: WorkflowDslNode,
  nodeIds: Set<string>,
  diagnostics: WorkflowDiagnostic[],
): void {
  if (node.dependsOn) {
    for (const dep of node.dependsOn) {
      if (!nodeIds.has(dep)) {
        diagnostics.push(createDiagnostic(
          DslDiagnosticCodes.INVALID_DEPENDS_ON,
          "error",
          `节点 "${node.id}" 依赖的节点 "${dep}" 不存在`,
          { nodeId: node.id },
        ));
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      if (!nodeIds.has(child)) {
        diagnostics.push(createDiagnostic(
          DslDiagnosticCodes.MISSING_CHILDREN_TARGET,
          "error",
          `节点 "${node.id}" 的子节点 "${child}" 不存在`,
          { nodeId: node.id },
        ));
      }
    }
  }

  if (node.inputs) {
    for (const [key, ref] of Object.entries(node.inputs)) {
      const vref = typeof ref === "string"
        ? ref.startsWith("$") ? undefined : undefined
        : ref;
      if (vref && typeof vref === "object" && "from" in vref && (vref as any).from === "node.output") {
        const nodeId = (vref as any).nodeId;
        if (!nodeIds.has(nodeId)) {
          diagnostics.push(createDiagnostic(
            DslDiagnosticCodes.INVALID_VALUE_REF_TARGET,
            "error",
            `节点 "${node.id}" 的 inputs.${key} 引用了不存在的节点 "${nodeId}"`,
            { nodeId: node.id },
          ));
        }
      }
    }
  }

  if (node.executor?.type === "agent") {
    validateAgentNode(node, diagnostics);
  }
}

function validateAgentNode(
  node: WorkflowDslNode,
  diagnostics: WorkflowDiagnostic[],
): void {
  if (node.capabilities?.skills) {
    for (let i = 0; i < node.capabilities.skills.length; i++) {
      const skill = node.capabilities.skills[i];
      if (!skill.name || typeof skill.name !== "string") {
        diagnostics.push(createDiagnostic(
          DslDiagnosticCodes.INVALID_AGENT_CONFIG,
          "error",
          `agent 节点 "${node.id}" 的 skills[${i}] 缺少 name`,
          { nodeId: node.id },
        ));
      }
    }
  }

  if (node.capabilities?.tools) {
    for (let i = 0; i < node.capabilities.tools.length; i++) {
      const tool = node.capabilities.tools[i];
      if (!tool.name || typeof tool.name !== "string") {
        diagnostics.push(createDiagnostic(
          DslDiagnosticCodes.INVALID_AGENT_CONFIG,
          "error",
          `agent 节点 "${node.id}" 的 tools[${i}] 缺少 name`,
          { nodeId: node.id },
        ));
      }
    }
  }

  if (node.capabilities?.mcp) {
    for (let i = 0; i < node.capabilities.mcp.length; i++) {
      const mcp = node.capabilities.mcp[i];
      if (!mcp.server || typeof mcp.server !== "string") {
        diagnostics.push(createDiagnostic(
          DslDiagnosticCodes.INVALID_AGENT_CONFIG,
          "error",
          `agent 节点 "${node.id}" 的 mcp[${i}] 缺少 server`,
          { nodeId: node.id },
        ));
      }
    }
  }
}
