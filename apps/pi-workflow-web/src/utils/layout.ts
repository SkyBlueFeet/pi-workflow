import type { GraphModel, GraphNode } from "../types/graph.js";

/** 简单拓扑布局：按 dependsOn 分层，每层水平排列 */
export function autoLayout(model: GraphModel): GraphNode[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of model.nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of model.edges) {
    if (edge.type === "dependency") {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const layers: string[][] = [];
  const queue = [...model.nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0).map(n => n.id)];

  const level = new Map<string, number>();
  for (const id of queue) level.set(id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = level.get(current) ?? 0;

    while (layers.length <= currentLevel) layers.push([]);
    layers[currentLevel].push(current);

    for (const next of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDegree);
      level.set(next, Math.max(level.get(next) ?? 0, currentLevel + 1));
      if (newDegree === 0) queue.push(next);
    }
  }

  const H_GAP = 320;
  const V_GAP = 160;
  const positioned = new Map<string, { x: number; y: number }>();

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const nodesInLayer = layers[layerIdx];
    const totalWidth = (nodesInLayer.length - 1) * H_GAP;
    const startX = -totalWidth / 2;

    for (let i = 0; i < nodesInLayer.length; i++) {
      positioned.set(nodesInLayer[i], {
        x: startX + i * H_GAP,
        y: layerIdx * V_GAP,
      });
    }
  }

  return model.nodes.map(node => {
    const pos = positioned.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });
}
