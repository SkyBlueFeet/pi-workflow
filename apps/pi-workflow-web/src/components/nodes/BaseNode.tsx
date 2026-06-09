import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "../../types/graph.js";
import { NODE_TYPE_REGISTRY } from "../../types/registry.js";
import type { WorkflowNodeKind } from "@pi-workflow/core";

type BaseNodeProps = NodeProps & {
  data: GraphNodeData & { kind?: WorkflowNodeKind };
};

const BaseNode = memo(({ id, data, selected }: BaseNodeProps) => {
  const kind = (data as any).kind ?? (data as any).type ?? "manual";
  const meta = NODE_TYPE_REGISTRY[kind as WorkflowNodeKind];
  const { color, icon, label } = meta ?? {
    color: "#6B7280",
    icon: "●",
    label: kind,
  };
  const errors = data.errors ?? [];
  const hasErrors = errors.length > 0;

  const inputEntries = Object.entries(data.inputs ?? {}).slice(0, 3);
  const children = (data as any).children as string[] | undefined;
  const hasChildrenHandle = meta?.category === "composite";

  return (
    <div
      className={`workflow-node ${selected ? "selected" : ""} ${hasErrors ? "has-errors" : ""}`}
      style={{
        border: hasErrors
          ? "2px solid #EF4444"
          : selected
            ? `2px solid ${color}`
            : `1px solid ${color}44`,
        borderRadius: 10,
        background: "#fff",
        minWidth: 200,
        boxShadow: selected ? `0 0 12px ${color}44` : "0 2px 6px rgba(0,0,0,0.08)",
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: color,
          color: "#fff",
          padding: "6px 12px",
          borderRadius: "8px 8px 0 0",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{icon}</span>
        <span style={{ flex: 1 }}>{data.title || label}</span>
        {hasErrors && <span style={{ color: "#FEE2E2" }}>⚠</span>}
      </div>

      {/* Body */}
      <div style={{ padding: "8px 12px" }}>
        {inputEntries.map(([key, ref]) => (
          <div key={key} style={{ color: "#6B7280", fontSize: 11, marginBottom: 2 }}>
            <span style={{ fontWeight: 500 }}>{key}:</span>{" "}
            <span>{describeValueRef(ref)}</span>
          </div>
        ))}
        {data.output?.to && (
          <div style={{ color: "#10B981", fontSize: 11, marginTop: 4 }}>
            → {data.output.to}
          </div>
        )}
        {children && children.length > 0 && (
          <div style={{ color: "#6366F1", fontSize: 11, marginTop: 2 }}>
            子节点: {children.length} 个
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      {hasChildrenHandle && (
        <Handle
          id="parent"
          type="target"
          position={Position.Left}
          style={{ background: "#6366F1", width: 10, height: 10 }}
        />
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      {hasChildrenHandle && (
        <Handle
          id="children"
          type="source"
          position={Position.Right}
          style={{ background: "#6366F1", width: 10, height: 10 }}
        />
      )}
    </div>
  );
});

BaseNode.displayName = "BaseNode";

function describeValueRef(ref: any): string {
  if (!ref) return "—";
  switch (ref.from) {
    case "literal":
      return typeof ref.value === "object"
        ? JSON.stringify(ref.value).slice(0, 30)
        : String(ref.value ?? "").slice(0, 30);
    case "run.input":
      return `$input.${ref.path ?? ""}`;
    case "node.output":
      return `$node:${ref.nodeId}.${ref.path ?? ""}`;
    case "frame.local":
      return `$local.${ref.path ?? ""}`;
    case "context":
      return `$ctx.${ref.path ?? ""}`;
    default:
      return JSON.stringify(ref).slice(0, 30);
  }
}

export default BaseNode;
