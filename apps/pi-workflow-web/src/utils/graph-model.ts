import type { GraphModel } from "../types/graph.js";

/**
 * 根据 parent-child 边实时回填节点的 children，避免画布关系与属性面板展示脱节。
 */
export function syncNodeChildren(model: GraphModel): GraphModel {
  const childrenByParent = new Map<string, string[]>();

  for (const edge of model.edges) {
    if (edge.type !== "parent-child") {
      continue;
    }

    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
  }

  return {
    ...model,
    nodes: model.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        children: childrenByParent.get(node.id),
      },
    })),
  };
}
