import { useState, useCallback, useRef } from "react";
import type { WorkflowDslDocument } from "@pi-workflow/core";
import type { GraphModel, GraphNode, GraphEdge, GraphNodeData } from "../types/graph.js";
import { dslToGraphModel, graphToDsl, generateNodeId } from "../types/dsl-bridge.js";
import { NODE_TYPE_REGISTRY } from "../types/registry.js";
import { syncNodeChildren } from "../utils/graph-model.js";
import { autoLayout } from "../utils/layout.js";
import { quickValidate } from "../utils/validator.js";
import type { WorkflowNodeKind } from "@pi-workflow/core";

export interface WorkflowState {
  model: GraphModel;
  selectedNodeId: string | null;
  dslDocument: WorkflowDslDocument | null;
  lastAction: string;
}

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>({
    model: {
      nodes: [],
      edges: [],
      entryNodeId: null,
      meta: { id: "new-workflow", version: "1.0", title: "新建工作流" },
    },
    selectedNodeId: null,
    dslDocument: null,
    lastAction: "初始化完成",
  });

  const modelRef = useRef(state.model);
  modelRef.current = state.model;

  /** 加载 JSON 工作流文件 */
  const loadFromJson = useCallback((json: string) => {
    const doc = JSON.parse(json) as WorkflowDslDocument;
    const model = syncNodeChildren(dslToGraphModel(doc));
    const validated = quickValidate(model);
    setState(prev => ({ ...prev, model: validated, dslDocument: doc }));
    return validated;
  }, []);

  /** 新建空工作流 */
  const newWorkflow = useCallback(() => {
    setState(prev => ({
      ...prev,
      model: {
        nodes: [],
        edges: [],
        entryNodeId: null,
        meta: { id: "new-workflow", version: "1.0", title: "新建工作流" },
      },
      dslDocument: null,
      lastAction: "已新建空工作流",
    }));
  }, []);

  /** 添加节点（从面板拖入或按钮创建） */
  const addNode = useCallback((kind: WorkflowNodeKind, position?: { x: number; y: number }) => {
    const meta = NODE_TYPE_REGISTRY[kind];
    const id = generateNodeId(kind);
    const nextIndex = state.model.nodes.length;
    const fallbackPosition = {
      x: 80 + (nextIndex % 4) * 220,
      y: 80 + Math.floor(nextIndex / 4) * 140,
    };
    const newNode: GraphNode = {
      id,
      type: kind,
      position: position ?? fallbackPosition,
      data: {
        title: meta.label,
        inputs: { ...meta.defaultInputs },
        children: undefined,
        control: undefined,
        capabilities: undefined,
        executor: undefined,
        missingInput: undefined,
        errors: [],
      } as GraphNodeData,
    };

    setState(prev => {
      const model = syncNodeChildren({
        ...prev.model,
        nodes: [...prev.model.nodes, newNode],
        entryNodeId: prev.model.entryNodeId ?? (prev.model.nodes.length === 0 ? id : prev.model.entryNodeId),
      });
      return {
        ...prev,
        model,
        lastAction: `已添加节点 ${id} @ (${Math.round(newNode.position.x)}, ${Math.round(newNode.position.y)})`,
      };
    });
  }, [state.model.nodes.length]);

  /** 更新节点数据（属性面板编辑） */
  const updateNodeData = useCallback((nodeId: string, patch: Partial<GraphNodeData>) => {
    setState(prev => ({
      ...prev,
      model: syncNodeChildren({
        ...prev.model,
        nodes: prev.model.nodes.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }),
    }));
  }, []);

  /** 添加边 */
  const addEdge = useCallback((edge: GraphEdge) => {
    setState(prev => ({
      ...prev,
      model: syncNodeChildren({
        ...prev.model,
        edges: [...prev.model.edges.filter(e => e.id !== edge.id), edge],
      }),
      lastAction: `已添加连线 ${edge.source} -> ${edge.target} (${edge.type})`,
    }));
  }, []);

  /** 删除边 */
  const removeEdge = useCallback((edgeId: string) => {
    setState(prev => ({
      ...prev,
      model: syncNodeChildren({
        ...prev.model,
        edges: prev.model.edges.filter(e => e.id !== edgeId),
      }),
      lastAction: `已删除连线 ${edgeId}`,
    }));
  }, []);

  /** 删除节点 */
  const removeNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      selectedNodeId: prev.selectedNodeId === nodeId ? null : prev.selectedNodeId,
      model: syncNodeChildren({
        ...prev.model,
        nodes: prev.model.nodes.filter(n => n.id !== nodeId),
        edges: prev.model.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        entryNodeId: prev.model.entryNodeId === nodeId ? null : prev.model.entryNodeId,
      }),
      lastAction: `已删除节点 ${nodeId}`,
    }));
  }, []);

  /** 选中节点 */
  const selectNode = useCallback((nodeId: string | null) => {
    setState(prev => ({ ...prev, selectedNodeId: nodeId }));
  }, []);

  /** 设置入口节点 */
  const setEntryNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      model: {
        ...prev.model,
        entryNodeId: nodeId,
      },
      selectedNodeId: nodeId,
    }));
  }, []);

  /** 自动布局 */
  const doAutoLayout = useCallback(() => {
    setState(prev => ({
      ...prev,
      model: {
        ...prev.model,
        nodes: autoLayout(prev.model),
      },
    }));
  }, []);

  /** 运行校验 */
  const validate = useCallback(() => {
    setState(prev => ({
      ...prev,
      model: quickValidate(syncNodeChildren(prev.model)),
    }));
  }, []);

  /** 导出 DSL JSON */
  const exportDsl = useCallback((): WorkflowDslDocument => {
    return graphToDsl(modelRef.current);
  }, []);

  /** 更新节点位置 */
  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setState(prev => ({
      ...prev,
      model: {
        ...prev.model,
        nodes: prev.model.nodes.map(n =>
          n.id === nodeId ? { ...n, position } : n,
        ),
      },
    }));
  }, []);

  const selectedNode = state.model.nodes.find(n => n.id === state.selectedNodeId) ?? null;

  return {
    model: state.model,
    selectedNodeId: state.selectedNodeId,
    selectedNode,
    dslDocument: state.dslDocument,
    lastAction: state.lastAction,
    loadFromJson,
    newWorkflow,
    addNode,
    updateNodeData,
    addEdge,
    removeEdge,
    removeNode,
    selectNode,
    setEntryNode,
    doAutoLayout,
    validate,
    exportDsl,
    updateNodePosition,
  };
}
