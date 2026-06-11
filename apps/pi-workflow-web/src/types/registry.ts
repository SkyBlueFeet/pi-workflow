import type { WorkflowNodeKind, ValueRef } from "@pi-workflow/core";
import type { NodeTypeMeta } from "./graph.js";

/** 全部节点类型的可视化注册表 */
export const NODE_TYPE_REGISTRY: Record<WorkflowNodeKind, NodeTypeMeta> = {
  manual: {
    kind: "manual", label: "手动", color: "#6B7280", icon: "✋",
    category: "primitive", defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  return: {
    kind: "return", label: "返回", color: "#10B981", icon: "↩",
    category: "primitive", defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  agent: {
    kind: "agent", label: "智能体", color: "#8B5CF6", icon: "🤖",
    category: "primitive",
    defaultInputs: { system_prompt: { from: "literal", value: "" }, user_prompt: { from: "literal", value: "" } },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: true, hasExecutorConfig: false,
  },
  tool: {
    kind: "tool", label: "工具", color: "#F59E0B", icon: "🔧",
    category: "primitive",
    defaultInputs: { toolName: { from: "literal", value: "" }, params: { from: "literal", value: {} } },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  http: {
    kind: "http", label: "HTTP", color: "#3B82F6", icon: "🌐",
    category: "primitive",
    defaultInputs: { url: { from: "literal", value: "" }, method: { from: "literal", value: "GET" } },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  extractor: {
    kind: "extractor", label: "提取器", color: "#EC4899", icon: "🔍",
    category: "primitive", defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: true,
  },
  template: {
    kind: "template", label: "模板", color: "#F97316", icon: "🧩",
    category: "primitive",
    defaultInputs: { template: { from: "literal", value: "" } as ValueRef },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  assign: {
    kind: "assign", label: "赋值", color: "#22C55E", icon: "📝",
    category: "primitive",
    defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  merge: {
    kind: "merge", label: "合并", color: "#0EA5E9", icon: "🪢",
    category: "primitive",
    defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  code: {
    kind: "code", label: "代码", color: "#A855F7", icon: "💻",
    category: "primitive",
    defaultInputs: { script: { from: "literal", value: "" } as ValueRef },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: true,
  },
  delay: {
    kind: "delay", label: "延迟", color: "#64748B", icon: "⏳",
    category: "primitive",
    defaultInputs: { delayMs: { from: "literal", value: 1000 } as ValueRef },
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  "list-op": {
    kind: "list-op", label: "列表操作", color: "#14B8A6", icon: "📚",
    category: "primitive",
    defaultInputs: {},
    hasChildren: false, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: true,
  },
  if: {
    kind: "if", label: "条件", color: "#EF4444", icon: "❓",
    category: "composite", defaultInputs: {},
    hasChildren: true, hasCondition: true, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  parallel: {
    kind: "parallel", label: "并行", color: "#06B6D4", icon: "⇉",
    category: "composite", defaultInputs: {},
    hasChildren: true, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  loop: {
    kind: "loop", label: "循环", color: "#14B8A6", icon: "🔁",
    category: "composite", defaultInputs: {},
    hasChildren: true, hasCondition: false, hasLoopConfig: true,
    hasCapabilities: false, hasExecutorConfig: false,
  },
  workflow: {
    kind: "workflow", label: "子工作流", color: "#6366F1", icon: "📦",
    category: "composite", defaultInputs: {},
    hasChildren: true, hasCondition: false, hasLoopConfig: false,
    hasCapabilities: false, hasExecutorConfig: false,
  },
};

export function getNodesByCategory(): { primitives: NodeTypeMeta[]; composites: NodeTypeMeta[] } {
  const primitives: NodeTypeMeta[] = [];
  const composites: NodeTypeMeta[] = [];
  for (const meta of Object.values(NODE_TYPE_REGISTRY)) {
    (meta.category === "primitive" ? primitives : composites).push(meta);
  }
  return { primitives, composites };
}
