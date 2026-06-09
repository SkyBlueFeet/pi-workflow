import type { DragEvent } from "react";
import { getNodesByCategory, NODE_TYPE_REGISTRY } from "../types/registry.js";
import type { WorkflowNodeKind } from "@pi-workflow/core";

interface NodePaletteProps {
  onAddNode: (kind: WorkflowNodeKind) => void;
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const { primitives, composites } = getNodesByCategory();

  const handleDragStart = (event: DragEvent, kind: WorkflowNodeKind) => {
    event.dataTransfer.setData("application/workflow-node-kind", kind);
    event.dataTransfer.effectAllowed = "move";
    (event.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (event: DragEvent) => {
    (event.target as HTMLElement).style.opacity = "1";
  };

  const renderNodeItem = (meta: (typeof NODE_TYPE_REGISTRY)[WorkflowNodeKind]) => (
    <div
      key={meta.kind}
      draggable
      onDragStart={(e) => handleDragStart(e, meta.kind)}
      onDragEnd={handleDragEnd}
      onClick={() => onAddNode(meta.kind)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        marginBottom: 6, borderRadius: 8, border: `1px solid ${meta.color}44`,
        background: "#fff", cursor: "grab", fontSize: 13,
        transition: "box-shadow 0.15s", userSelect: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${meta.color}44`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      <span style={{ display: "inline-flex", width: 28, height: 28, borderRadius: 6, background: meta.color, color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
        {meta.icon}
      </span>
      <span style={{ fontWeight: 500 }}>{meta.label}</span>
      <span style={{ color: "#94A3B8", fontSize: 11, marginLeft: "auto" }}>
        {meta.category === "composite" ? "复合" : ""}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddNode(meta.kind);
        }}
        style={{
          marginLeft: 6,
          border: "none",
          borderRadius: 999,
          background: meta.color,
          color: "#fff",
          width: 22,
          height: 22,
          cursor: "pointer",
          fontSize: 14,
          lineHeight: "22px",
        }}
        title={`添加${meta.label}节点`}
      >
        +
      </button>
    </div>
  );

  return (
    <div style={{ width: 220, height: "100%", borderRight: "1px solid #E2E8F0", background: "#FAFBFC", padding: "12px 10px", overflowY: "auto" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>节点面板</h3>
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 6px", textTransform: "uppercase" }}>基元节点</h4>
        {primitives.map(renderNodeItem)}
      </div>
      <div>
        <h4 style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 6px", textTransform: "uppercase" }}>复合节点</h4>
        {composites.map(renderNodeItem)}
      </div>
      <div style={{ marginTop: 20, padding: "8px", borderTop: "1px solid #E2E8F0", fontSize: 11, color: "#94A3B8" }}>
        拖拽节点到画布创建，或点击添加
      </div>
    </div>
  );
}
