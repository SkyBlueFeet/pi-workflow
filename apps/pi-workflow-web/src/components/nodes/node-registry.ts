import type { NodeTypes } from "@xyflow/react";
import BaseNode from "./BaseNode.js";

/**
 * ReactFlow 的 nodeTypes 映射。
 * 全部 10 种节点类型共用同一个 BaseNode 组件，
 * 通过节点 data 中的 kind 字段区分渲染颜色/图标。
 */
export const nodeTypes: NodeTypes = {
  manual: BaseNode,
  return: BaseNode,
  agent: BaseNode,
  tool: BaseNode,
  http: BaseNode,
  extractor: BaseNode,
  if: BaseNode,
  parallel: BaseNode,
  loop: BaseNode,
  workflow: BaseNode,
} as const;
