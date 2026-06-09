import type { WorkflowDslDocument, WorkflowNodeKind, ValueRef } from "@pi-workflow/core";
import type { GraphModel, GraphNode, GraphEdge } from "./graph.js";
import { NODE_TYPE_REGISTRY } from "./registry.js";

let idCounter = 0;

interface WorkflowDslLikeNode {
  id: string;
  title?: string;
  executor: {
    type: WorkflowNodeKind;
    [key: string]: unknown;
  };
  inputs?: Record<string, unknown>;
  output?: unknown;
  children?: string[];
  control?: unknown;
  capabilities?: unknown;
  missingInput?: unknown;
  dependsOn?: string[];
}

interface WorkflowDslExportNode {
  id: string;
  title: string;
  executor: {
    type: WorkflowNodeKind;
    config?: Readonly<Record<string, unknown>>;
  };
  inputs: Record<string, ValueRef>;
  output?: GraphNode["data"]["output"];
  children?: string[];
  control?: GraphNode["data"]["control"];
  capabilities?: GraphNode["data"]["capabilities"];
  missingInput?: GraphNode["data"]["missingInput"];
  dependsOn?: string[];
}

/** 生成唯一节点 ID */
export function generateNodeId(kind: string): string {
  return `${kind}-${++idCounter}`;
}

// ─── DSL → GraphModel ────────────────────────────────────

/**
 * 将 WorkflowDslDocument 转换为画布图模型。
 */
export function dslToGraphModel(doc: WorkflowDslDocument): GraphModel {
  const dslNodes = doc.nodes as WorkflowDslLikeNode[];
  const graphNodes: GraphNode[] = dslNodes.map((dslNode, index) => {
    const meta = NODE_TYPE_REGISTRY[dslNode.executor.type];

    // 将非 ValueRef 的简单值归一化为 literal，保证编辑器内部结构稳定。
    const inputs: Record<string, ValueRef> = {};
    if (dslNode.inputs) {
      for (const [key, val] of Object.entries(dslNode.inputs)) {
        if (typeof val === "object" && val !== null && "from" in val) {
          inputs[key] = val as ValueRef;
        } else {
          inputs[key] = { from: "literal", value: val } as ValueRef;
        }
      }
    }

    return {
      id: dslNode.id,
      type: dslNode.executor.type,
      position: { x: 100 + (index % 3) * 320, y: 80 + Math.floor(index / 3) * 180 },
      data: {
        title: dslNode.title ?? dslNode.id,
        inputs: Object.keys(inputs).length > 0 ? inputs : { ...meta.defaultInputs },
        output: dslNode.output as GraphNode["data"]["output"],
        children: dslNode.children ? [...dslNode.children] : undefined,
        control: dslNode.control as GraphNode["data"]["control"],
        capabilities: dslNode.capabilities as GraphNode["data"]["capabilities"],
        executor: dslNode.executor as GraphNode["data"]["executor"],
        missingInput: dslNode.missingInput as GraphNode["data"]["missingInput"],
        errors: [],
      },
    };
  });

  const graphEdges: GraphEdge[] = [];
  for (const dslNode of dslNodes) {
    if (dslNode.dependsOn) {
      for (const dep of dslNode.dependsOn) {
        graphEdges.push({
          id: `dep-${dep}-${dslNode.id}`,
          source: dep,
          target: dslNode.id,
          type: "dependency",
        });
      }
    }
    if (dslNode.children) {
      for (const childId of dslNode.children) {
        graphEdges.push({
          id: `child-${dslNode.id}-${childId}`,
          source: dslNode.id,
          target: childId,
          type: "parent-child",
        });
      }
    }
  }

  return {
    nodes: graphNodes,
    edges: graphEdges,
    entryNodeId: (doc as any).entry ?? null,
    meta: {
      id: doc.id,
      version: doc.version,
      title: doc.title,
    },
  };
}

// ─── GraphModel → DSL ────────────────────────────────────

export function graphToDsl(model: GraphModel): WorkflowDslDocument {
  const dependsOnMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();

  for (const edge of model.edges) {
    if (edge.type === "dependency") {
      const deps = dependsOnMap.get(edge.target) ?? [];
      deps.push(edge.source);
      dependsOnMap.set(edge.target, deps);
    } else if (edge.type === "parent-child") {
      const children = childrenMap.get(edge.source) ?? [];
      children.push(edge.target);
      childrenMap.set(edge.source, children);
    }
  }

  const nodes: WorkflowDslExportNode[] = model.nodes.map(gn => {
    const meta = NODE_TYPE_REGISTRY[gn.type];
    const executor = gn.data.executor ?? { type: gn.type };
    const node: WorkflowDslExportNode = {
      id: gn.id,
      title: gn.data.title || gn.id,
      executor: { ...executor, type: gn.type },
      inputs: Object.keys(gn.data.inputs).length > 0
        ? gn.data.inputs
        : { ...meta.defaultInputs },
      output: gn.data.output,
      children: childrenMap.get(gn.id),
      control: gn.data.control,
      capabilities: gn.data.capabilities,
      missingInput: gn.data.missingInput,
    };

    const deps = dependsOnMap.get(gn.id);
    if (deps && deps.length > 0) {
      node.dependsOn = deps;
    }

    return node;
  });

  return {
    id: model.meta.id,
    version: model.meta.version,
    title: model.meta.title,
    entry: model.entryNodeId ?? "",
    nodes,
  } as WorkflowDslDocument;
}
