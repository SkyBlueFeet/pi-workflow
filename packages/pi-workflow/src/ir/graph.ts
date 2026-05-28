import type { WorkflowDefinitionIR } from "./types.js";

/**
 * 对工作流 IR 进行拓扑排序，返回按依赖序排列的节点 ID 列表。
 * 检测到循环依赖时抛出错误。
 *
 * @param ir 工作流定义 IR
 * @returns 拓扑排序后的节点 ID 数组（入口节点在前）
 * @throws 存在循环依赖时抛出
 */
export function topologicalSort(ir: WorkflowDefinitionIR): readonly string[] {
  const perm = new Set<string>();
  const temp = new Set<string>();
  const result: string[] = [];
  const adj = buildAdjacencyMap(ir);

  function visit(nodeId: string): void {
    if (perm.has(nodeId)) return;
    if (temp.has(nodeId)) throw new Error(`检测到循环依赖，节点: ${nodeId}`);
    temp.add(nodeId);
    const deps = adj.get(nodeId) ?? [];
    for (const dep of deps) visit(dep);
    temp.delete(nodeId);
    perm.add(nodeId);
    result.push(nodeId);
  }

  for (const nodeId of ir.entryNodeIds) visit(nodeId);

  return result;
}

/** 构建节点 ID → 依赖 ID 列表的邻接表。 */
function buildAdjacencyMap(ir: WorkflowDefinitionIR): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of ir.nodes) {
    const list = map.get(node.id) ?? [];
    list.push(...node.dependsOn);
    map.set(node.id, list);
  }
  return map;
}
