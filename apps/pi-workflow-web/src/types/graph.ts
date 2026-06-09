import type {
  WorkflowNodeKind,
  ValueRef,
} from "@pi-workflow/core";

// ─── 图模型 ─────────────────────────────────────────────

/** 画布内部表示的可视化节点 */
export interface GraphNode {
  id: string;
  type: WorkflowNodeKind;
  position: { x: number; y: number };
  data: GraphNodeData;
}

/** 节点携带的 DSL 字段 + 编辑态 */
export interface GraphNodeData {
  title: string;
  inputs: Record<string, ValueRef>;
  output?: WorkflowDslOutputBinding;
  children?: string[];
  control?: WorkflowDslControlConfig;
  capabilities?: Record<string, unknown>;
  executor?: WorkflowDslExecutorConfig;
  missingInput?: WorkflowMissingInput;
  /** 验证错误列表 */
  errors: string[];
}

/** 可视化边，区分依赖和父子关系 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "dependency" | "parent-child";
}

/** 顶层图模型 */
export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryNodeId: string | null;
  meta: {
    id: string;
    version: string;
    title: string;
  };
}

// ─── DSL 类型的本地补充（@pi-workflow/core 未全部导出） ──

export interface WorkflowDslOutputBinding {
  readonly to?: string;
  readonly mergeStrategy?: "replace" | "merge-object" | "append-array";
}

export interface WorkflowDslControlConfig {
  readonly condition?: ValueRef;
  readonly loopOver?: ValueRef;
  readonly itemName?: string;
  readonly maxConcurrency?: number;
  readonly timeoutMs?: number;
}

export interface WorkflowDslExecutorConfig {
  readonly type: WorkflowNodeKind;
  readonly config?: Readonly<Record<string, unknown>>;
}

export interface WorkflowMissingInput {
  readonly mode: "ask_user" | "fail" | "skip";
}

// ─── 节点类型元信息 ──────────────────────────────────────

export type NodeCategory = "primitive" | "composite";

export interface NodeTypeMeta {
  kind: WorkflowNodeKind;
  label: string;
  color: string;
  icon: string;
  category: NodeCategory;
  defaultInputs: Record<string, ValueRef>;
  hasChildren: boolean;
  hasCondition: boolean;
  hasLoopConfig: boolean;
  hasCapabilities: boolean;
  hasExecutorConfig: boolean; // extractor
}
