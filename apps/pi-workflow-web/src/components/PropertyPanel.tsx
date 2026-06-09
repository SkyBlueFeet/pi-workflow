import type { GraphNode, GraphNodeData } from "../types/graph.js";
import { NODE_TYPE_REGISTRY } from "../types/registry.js";
import type { ValueRef } from "@pi-workflow/core";
import InputBindingEditor from "./properties/InputBindingEditor.js";
import OutputConfigEditor from "./properties/OutputConfigEditor.js";
import ControlEditor from "./properties/ControlEditor.js";
import CapabilitiesEditor from "./properties/CapabilitiesEditor.js";
import ExecutorConfigEditor from "./properties/ExecutorConfigEditor.js";

interface PropertyPanelProps {
  node: GraphNode | null;
  allNodeIds: string[];
  onUpdate: (nodeId: string, patch: Partial<GraphNodeData>) => void;
  onDelete: (nodeId: string) => void;
  onSetEntry: (nodeId: string) => void;
  isEntry: boolean;
}

export default function PropertyPanel({
  node, allNodeIds, onUpdate, onDelete, onSetEntry, isEntry,
}: PropertyPanelProps) {
  if (!node) {
    return <div style={{ width: 300, padding: 16, color: "#94A3B8", fontSize: 13 }}>选中一个节点以编辑属性</div>;
  }

  const meta = NODE_TYPE_REGISTRY[node.type] ?? NODE_TYPE_REGISTRY["manual"];

  return (
    <div style={{ width: 300, height: "100%", borderLeft: "1px solid #E2E8F0", background: "#FAFBFC", padding: "12px 14px", overflowY: "auto", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 5, background: meta.color, color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{meta.icon}</span>
        <input style={{ flex: 1, fontWeight: 600, border: "1px solid #E2E8F0", borderRadius: 5, padding: "4px 8px" }}
          value={node.data.title} onChange={(e) => onUpdate(node.id, { title: e.target.value })} />
      </div>
      <div style={{ marginBottom: 10 }}>
        {isEntry ? (
          <span style={{ background: "#10B981", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>入口节点</span>
        ) : (
          <button onClick={() => onSetEntry(node.id)}
            style={{ border: "1px solid #10B981", color: "#10B981", background: "transparent", padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>设为入口</button>
        )}
      </div>
      <button onClick={() => onDelete(node.id)}
        style={{ marginBottom: 14, border: "1px solid #EF4444", color: "#EF4444", background: "transparent", padding: "3px 10px", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>删除节点</button>
      <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
      <InputBindingEditor inputs={node.data.inputs} allNodeIds={allNodeIds} currentId={node.id}
        onUpdate={(key, ref) => onUpdate(node.id, { inputs: { ...node.data.inputs, [key]: ref } })}
        onAdd={(key) => { if (!node.data.inputs[key]) onUpdate(node.id, { inputs: { ...node.data.inputs, [key]: { from: "literal", value: "" } } }); }}
        onRemove={(key) => { const next = { ...node.data.inputs }; delete next[key]; onUpdate(node.id, { inputs: next }); }} />
      <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
      <OutputConfigEditor output={node.data.output as any} onChange={(o) => onUpdate(node.id, { output: o as any })} />
      {(meta.hasCondition || meta.hasLoopConfig) && (<>
        <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
        <ControlEditor control={node.data.control as any} kind={node.type} onChange={(c) => onUpdate(node.id, { control: c as any })} />
      </>)}
      {meta.hasCapabilities && (<>
        <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
        <CapabilitiesEditor capabilities={node.data.capabilities} onChange={(c) => onUpdate(node.id, { capabilities: c })} />
      </>)}
      {meta.hasExecutorConfig && (<>
        <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
        <ExecutorConfigEditor executor={node.data.executor as any} onChange={(e) => onUpdate(node.id, { executor: e as any })} />
      </>)}
      {node.data.errors.length > 0 && (<>
        <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "10px 0" }} />
        <div style={{ color: "#EF4444", fontSize: 12 }}>
          {node.data.errors.map((err: string, i: number) => <div key={i} style={{ marginBottom: 4 }}>⚠ {err}</div>)}
        </div>
      </>)}
    </div>
  );
}
