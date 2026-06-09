import { useCallback, useMemo, useRef, useState } from "react";
import type { Connection } from "@xyflow/react";
import type { WorkflowNodeKind } from "@pi-workflow/core";
import type { GraphEdge, GraphModel, GraphNode } from "../types/graph.js";
import { NODE_TYPE_REGISTRY } from "../types/registry.js";

interface CanvasProps {
  model: GraphModel;
  onNodesChange: (nodes: GraphModel["nodes"]) => void;
  onEdgesChange: (edges: GraphModel["edges"]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  onDropNode: (kind: WorkflowNodeKind, position: { x: number; y: number }) => void;
}

type PortRole = "source" | "target";
type DragState = {
  nodeId: string;
  offset: { x: number; y: number };
};
type PendingConnection = {
  nodeId: string;
  handleId?: string;
  edgeType: GraphEdge["type"];
};
type ConnectionDragState = PendingConnection & {
  current: { x: number; y: number };
};
type DependencyDirection = "vertical" | "horizontal";

const NODE_WIDTH = 220;
const NODE_MIN_HEIGHT = 92;
const GRID_SIZE = 20;

export default function Canvas({
  model,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onNodeDelete,
  onEdgeDelete,
  onDropNode,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dependencyDirection, setDependencyDirection] = useState<DependencyDirection>("vertical");

  const nodeMap = useMemo(() => {
    return new Map(model.nodes.map(node => [node.id, node]));
  }, [model.nodes]);

  const toCanvasPosition = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: clientX, y: clientY };
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData("application/workflow-node-kind") as WorkflowNodeKind;
    if (!kind) {
      return;
    }
    onDropNode(kind, toCanvasPosition(event.clientX, event.clientY));
  }, [onDropNode, toCanvasPosition]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (connectionDrag) {
      setConnectionDrag({
        ...connectionDrag,
        current: toCanvasPosition(event.clientX, event.clientY),
      });
      return;
    }
    if (!dragState) {
      return;
    }
    const position = toCanvasPosition(event.clientX, event.clientY);
    const nextNodes = model.nodes.map(node => (
      node.id === dragState.nodeId
        ? {
          ...node,
          position: {
            x: Math.round((position.x - dragState.offset.x) / GRID_SIZE) * GRID_SIZE,
            y: Math.round((position.y - dragState.offset.y) / GRID_SIZE) * GRID_SIZE,
          },
        }
        : node
    ));
    onNodesChange(nextNodes);
  }, [connectionDrag, dragState, model.nodes, onNodesChange, toCanvasPosition]);

  const finishConnectionDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!connectionDrag) {
      return;
    }
    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-workflow-port]");
    const targetNodeId = targetElement?.dataset.nodeId;
    const targetRole = targetElement?.dataset.role as PortRole | undefined;
    const targetHandleId = targetElement?.dataset.handleId;

    if (targetNodeId && targetRole === "target" && targetNodeId !== connectionDrag.nodeId) {
      onConnect({
        source: connectionDrag.nodeId,
        target: targetNodeId,
        sourceHandle: connectionDrag.handleId ?? null,
        targetHandle: targetHandleId || null,
      } as Connection);
    }
    setConnectionDrag(null);
    setPendingConnection(null);
  }, [connectionDrag, onConnect]);

  const handleNodePointerDown = useCallback((
    event: React.PointerEvent<HTMLDivElement>,
    node: GraphNode,
  ) => {
    event.stopPropagation();
    const position = toCanvasPosition(event.clientX, event.clientY);
    setSelectedEdgeId(null);
    onNodeClick(node.id);
    setDragState({
      nodeId: node.id,
      offset: {
        x: position.x - node.position.x,
        y: position.y - node.position.y,
      },
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [onNodeClick, toCanvasPosition]);

  const handlePortClick = useCallback((
    event: React.MouseEvent,
    node: GraphNode,
    role: PortRole,
    handleId?: string,
  ) => {
    event.stopPropagation();
    if (role === "source") {
      setPendingConnection({
        nodeId: node.id,
        handleId,
        edgeType: handleId === "children" ? "parent-child" : "dependency",
      });
      return;
    }
    if (!pendingConnection || pendingConnection.nodeId === node.id) {
      setPendingConnection(null);
      return;
    }
    onConnect({
      source: pendingConnection.nodeId,
      target: node.id,
      sourceHandle: pendingConnection.handleId ?? null,
      targetHandle: handleId ?? null,
    } as Connection);
    setPendingConnection(null);
  }, [onConnect, pendingConnection]);

  const handlePortPointerDown = useCallback((
    event: React.PointerEvent,
    node: GraphNode,
    role: PortRole,
    handleId?: string,
  ) => {
    event.stopPropagation();
    if (role !== "source") {
      return;
    }
    setSelectedEdgeId(null);
    setPendingConnection(null);
    setConnectionDrag({
      nodeId: node.id,
      handleId,
      edgeType: handleId === "children" ? "parent-child" : "dependency",
      current: toCanvasPosition(event.clientX, event.clientY),
    });
  }, [toCanvasPosition]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }
    if (selectedEdgeId) {
      onEdgeDelete(selectedEdgeId);
      setSelectedEdgeId(null);
    }
  }, [onEdgeDelete, selectedEdgeId]);

  const clearSelection = useCallback(() => {
    setPendingConnection(null);
    setConnectionDrag(null);
    setSelectedEdgeId(null);
    onPaneClick();
  }, [onPaneClick]);

  return (
    <div
      ref={canvasRef}
      tabIndex={0}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        finishConnectionDrag(event);
        setDragState(null);
      }}
      onPointerCancel={() => {
        setConnectionDrag(null);
        setDragState(null);
      }}
      onKeyDown={handleKeyDown}
      onClick={clearSelection}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#F8FAFC",
        backgroundImage:
          "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
      }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="workflow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#64748B" />
          </marker>
        </defs>
        {model.edges.map(edge => (
          <EdgePath
            key={edge.id}
            edge={edge}
            source={nodeMap.get(edge.source)}
            target={nodeMap.get(edge.target)}
            selected={edge.id === selectedEdgeId}
            dependencyDirection={dependencyDirection}
            onSelect={(event) => {
              event.stopPropagation();
              setSelectedEdgeId(edge.id);
            }}
            onDelete={() => onEdgeDelete(edge.id)}
          />
        ))}
        {connectionDrag && (
          <ConnectionPreview
            source={nodeMap.get(connectionDrag.nodeId)}
            current={connectionDrag.current}
            edgeType={connectionDrag.edgeType}
            dependencyDirection={dependencyDirection}
          />
        )}
      </svg>

      {model.nodes.map(node => (
        <WorkflowNodeView
          key={node.id}
          node={node}
          isConnecting={pendingConnection?.nodeId === node.id}
          connectionDrag={connectionDrag}
          dependencyDirection={dependencyDirection}
          onPointerDown={(event) => handleNodePointerDown(event, node)}
          onPortClick={(event, role, handleId) => handlePortClick(event, node, role, handleId)}
          onPortPointerDown={(event, role, handleId) => handlePortPointerDown(event, node, role, handleId)}
          onDelete={() => onNodeDelete(node.id)}
        />
      ))}

      <div style={debugPanelStyle}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>画布调试</div>
        {model.nodes.length === 0 ? (
          <div>当前没有节点</div>
        ) : (
          model.nodes.map(node => (
            <div key={node.id} style={{ marginBottom: 4 }}>
              {node.id} [{Math.round(node.position.x)}, {Math.round(node.position.y)}]
            </div>
          ))
        )}
        {pendingConnection && (
          <div style={{ marginTop: 6, color: "#2563EB" }}>
            连线起点: {pendingConnection.nodeId}
          </div>
        )}
        {connectionDrag && (
          <div style={{ marginTop: 6, color: "#2563EB" }}>
            正在拖拽连线: {connectionDrag.nodeId}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdgesChange([]);
        }}
        style={clearEdgesButtonStyle}
      >
        清空连线
      </button>
      <div style={directionControlStyle} onClick={(event) => event.stopPropagation()}>
        <span style={{ color: "#64748B", fontSize: 12 }}>连线方向</span>
        <button
          type="button"
          onClick={() => setDependencyDirection("vertical")}
          style={directionButtonStyle(dependencyDirection === "vertical")}
        >
          上下
        </button>
        <button
          type="button"
          onClick={() => setDependencyDirection("horizontal")}
          style={directionButtonStyle(dependencyDirection === "horizontal")}
        >
          左右
        </button>
      </div>
    </div>
  );
}

function WorkflowNodeView({
  node,
  isConnecting,
  connectionDrag,
  dependencyDirection,
  onPointerDown,
  onPortClick,
  onPortPointerDown,
  onDelete,
}: {
  node: GraphNode;
  isConnecting: boolean;
  connectionDrag: ConnectionDragState | null;
  dependencyDirection: DependencyDirection;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPortClick: (event: React.MouseEvent, role: PortRole, handleId?: string) => void;
  onPortPointerDown: (event: React.PointerEvent, role: PortRole, handleId?: string) => void;
  onDelete: () => void;
}) {
  const meta = NODE_TYPE_REGISTRY[node.type];
  const color = meta?.color ?? "#64748B";
  const inputEntries = Object.entries(node.data.inputs ?? {}).slice(0, 2);
  const hasErrors = node.data.errors.length > 0;
  const isComposite = meta?.category === "composite";
  const canAcceptDependency = canAcceptConnection(node, connectionDrag, "target");
  const canAcceptParentChild = canAcceptConnection(node, connectionDrag, "target", "parent");
  const dependencyTargetPort = dependencyDirection === "vertical"
    ? { top: -6, left: NODE_WIDTH / 2 - 6 }
    : { top: NODE_MIN_HEIGHT / 2, left: -6 };
  const dependencySourcePort = dependencyDirection === "vertical"
    ? { bottom: -6, left: NODE_WIDTH / 2 - 6 }
    : { top: NODE_MIN_HEIGHT / 2, right: -6 };

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
        minHeight: NODE_MIN_HEIGHT,
        border: hasErrors ? "2px solid #EF4444" : `1px solid ${color}`,
        borderRadius: 8,
        background: "#FFFFFF",
        boxShadow: isConnecting ? `0 0 0 3px ${color}33` : "0 8px 20px rgba(15, 23, 42, 0.12)",
        cursor: "grab",
        userSelect: "none",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", color: "#FFFFFF", background: color, borderRadius: "7px 7px 0 0" }}>
        <span>{meta?.icon ?? "●"}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{node.data.title || meta?.label || node.type}</span>
        <span style={{ fontSize: 11, opacity: 0.9 }}>{node.type}</span>
        <button
          type="button"
          title="删除节点"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={{
            width: 20,
            height: 20,
            border: "1px solid rgba(255,255,255,0.75)",
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            color: "#FFFFFF",
            cursor: "pointer",
            lineHeight: "16px",
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "8px 10px", fontSize: 12, color: "#475569" }}>
        <div style={{ fontWeight: 600, color: "#1E293B", marginBottom: 4 }}>{node.id}</div>
        {inputEntries.length === 0 ? <div>无输入</div> : inputEntries.map(([key]) => <div key={key}>输入: {key}</div>)}
        {node.data.output?.to && <div style={{ color: "#059669", marginTop: 4 }}>输出: {node.data.output.to}</div>}
      </div>
      <Port nodeId={node.id} role="target" {...dependencyTargetPort} color={color} title="依赖输入" highlighted={canAcceptDependency} onClick={(event) => onPortClick(event, "target")} onPointerDown={(event) => onPortPointerDown(event, "target")} />
      <Port nodeId={node.id} role="source" {...dependencySourcePort} color={color} title="依赖输出" onClick={(event) => onPortClick(event, "source")} onPointerDown={(event) => onPortPointerDown(event, "source")} />
      {isComposite && (
        <>
          <Port nodeId={node.id} role="target" handleId="parent" top={NODE_MIN_HEIGHT / 2} left={-6} color="#6366F1" title="父子输入" highlighted={canAcceptParentChild} onClick={(event) => onPortClick(event, "target", "parent")} onPointerDown={(event) => onPortPointerDown(event, "target", "parent")} />
          <Port nodeId={node.id} role="source" handleId="children" top={NODE_MIN_HEIGHT / 2} right={-6} color="#6366F1" title="父子输出" onClick={(event) => onPortClick(event, "source", "children")} onPointerDown={(event) => onPortPointerDown(event, "source", "children")} />
        </>
      )}
    </div>
  );
}

type PortPosition = Pick<React.CSSProperties, "top" | "right" | "bottom" | "left">;

function Port({
  nodeId,
  role,
  handleId,
  color,
  title,
  highlighted = false,
  onClick,
  onPointerDown,
  ...position
}: PortPosition & {
  nodeId: string;
  role: PortRole;
  handleId?: string;
  color: string;
  title: string;
  highlighted?: boolean;
  onClick: (event: React.MouseEvent) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      data-workflow-port="true"
      data-node-id={nodeId}
      data-role={role}
      data-handle-id={handleId}
      title={title}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={{
        position: "absolute",
        width: 12,
        height: 12,
        padding: 0,
        border: highlighted ? "3px solid #FBBF24" : "2px solid #FFFFFF",
        borderRadius: 999,
        background: color,
        boxShadow: highlighted ? "0 0 0 6px rgba(251, 191, 36, 0.28)" : undefined,
        transform: highlighted ? "scale(1.35)" : undefined,
        cursor: "crosshair",
        ...position,
      }}
    />
  );
}

function canAcceptConnection(
  node: GraphNode,
  connectionDrag: ConnectionDragState | null,
  role: PortRole,
  handleId?: string,
) {
  if (!connectionDrag || role !== "target" || connectionDrag.nodeId === node.id) {
    return false;
  }
  if (connectionDrag.edgeType === "parent-child") {
    return handleId === "parent";
  }
  return handleId === undefined;
}

function ConnectionPreview({
  source,
  current,
  edgeType,
  dependencyDirection,
}: {
  source?: GraphNode;
  current: { x: number; y: number };
  edgeType: GraphEdge["type"];
  dependencyDirection: DependencyDirection;
}) {
  if (!source) {
    return null;
  }
  const sourceSide = getSourceAnchorSide(edgeType, dependencyDirection);
  const sourcePoint = getAnchor(source, sourceSide);
  const path = buildCurvePath(sourcePoint, current, sourceSide);

  return (
    <path
      d={path}
      fill="none"
      stroke={edgeType === "parent-child" ? "#6366F1" : "#2563EB"}
      strokeWidth={3}
      strokeDasharray="8 5"
      markerEnd="url(#workflow-arrow)"
      pointerEvents="none"
    />
  );
}

function EdgePath({
  edge,
  source,
  target,
  selected,
  dependencyDirection,
  onSelect,
  onDelete,
}: {
  edge: GraphEdge;
  source?: GraphNode;
  target?: GraphNode;
  selected: boolean;
  dependencyDirection: DependencyDirection;
  onSelect: (event: React.MouseEvent<SVGPathElement>) => void;
  onDelete: () => void;
}) {
  if (!source || !target) {
    return null;
  }
  const sourceSide = getSourceAnchorSide(edge.type, dependencyDirection);
  const targetSide = getTargetAnchorSide(edge.type, dependencyDirection);
  const sourcePoint = getAnchor(source, sourceSide);
  const targetPoint = getAnchor(target, targetSide);
  const path = buildCurvePath(sourcePoint, targetPoint, sourceSide);

  return (
    <path
      d={path}
      fill="none"
      stroke={selected ? "#EF4444" : edge.type === "parent-child" ? "#6366F1" : "#64748B"}
      strokeWidth={selected ? 4 : 2}
      strokeDasharray={edge.type === "parent-child" ? "6 4" : undefined}
      markerEnd="url(#workflow-arrow)"
      style={{ cursor: "pointer" }}
      onClick={onSelect}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
    />
  );
}

function getAnchor(node: GraphNode, side: "top" | "bottom" | "left" | "right") {
  switch (side) {
    case "top":
      return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y };
    case "bottom":
      return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_MIN_HEIGHT };
    case "left":
      return { x: node.position.x, y: node.position.y + NODE_MIN_HEIGHT / 2 };
    case "right":
      return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_MIN_HEIGHT / 2 };
  }
}

type AnchorSide = "top" | "bottom" | "left" | "right";

function getSourceAnchorSide(
  edgeType: GraphEdge["type"],
  dependencyDirection: DependencyDirection,
): AnchorSide {
  if (edgeType === "parent-child") {
    return "right";
  }
  return dependencyDirection === "vertical" ? "bottom" : "right";
}

function getTargetAnchorSide(
  edgeType: GraphEdge["type"],
  dependencyDirection: DependencyDirection,
): AnchorSide {
  if (edgeType === "parent-child") {
    return "left";
  }
  return dependencyDirection === "vertical" ? "top" : "left";
}

function buildCurvePath(
  sourcePoint: { x: number; y: number },
  targetPoint: { x: number; y: number },
  sourceSide: AnchorSide,
) {
  if (sourceSide === "left" || sourceSide === "right") {
    const offset = sourceSide === "right" ? 90 : -90;
    return `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + offset} ${sourcePoint.y}, ${targetPoint.x - offset} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`;
  }
  const midY = (sourcePoint.y + targetPoint.y) / 2;
  return `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x} ${midY}, ${targetPoint.x} ${midY}, ${targetPoint.x} ${targetPoint.y}`;
}

const debugPanelStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  zIndex: 10,
  minWidth: 220,
  maxWidth: 320,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  padding: "8px 10px",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  color: "#334155",
};

const clearEdgesButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: 12,
  zIndex: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 6,
  background: "#FFFFFF",
  color: "#334155",
  padding: "6px 10px",
  cursor: "pointer",
};

const directionControlStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: 54,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid #CBD5E1",
  borderRadius: 6,
  background: "#FFFFFF",
  padding: "5px 6px",
};

function directionButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 5,
    background: active ? "#2563EB" : "#E2E8F0",
    color: active ? "#FFFFFF" : "#334155",
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 12,
  };
}
