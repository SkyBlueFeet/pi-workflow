import type { Connection } from "@xyflow/react";
import type { WorkflowNodeKind } from "@pi-workflow/core";
import Canvas from "./components/Canvas.js";
import NodePalette from "./components/NodePalette.js";
import PropertyPanel from "./components/PropertyPanel.js";
import { useWorkflow } from "./hooks/useWorkflow.js";

export default function App() {
  const wf = useWorkflow();

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const edgeType: "dependency" | "parent-child" = (
      connection.targetHandle === "parent" || connection.sourceHandle === "children"
    )
      ? "parent-child"
      : "dependency";
    wf.addEdge({
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      type: edgeType,
    });
  };

  const handleExport = () => {
    const dsl = wf.exportDsl();
    const json = JSON.stringify(dsl, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dsl.id}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.workflow.json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => wf.loadFromJson(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSetEntry = (nodeId: string) => {
    wf.setEntryNode(nodeId);
  };

  const handleDropNode = (kind: WorkflowNodeKind, position: { x: number; y: number }) => {
    wf.addNode(kind, position);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F1F5F9" }}>
      {/* Toolbar */}
      <div
        style={{
          height: 48, background: "#1E293B", color: "#fff", display: "flex",
          alignItems: "center", padding: "0 16px", gap: 12, fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>Pi Workflow Editor</span>
        <span style={{ color: "#94A3B8", fontSize: 12, marginLeft: 8 }}>
          {wf.model.meta.title}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={wf.newWorkflow} style={btnStyle}>新建</button>
          <button onClick={handleLoad} style={btnStyle}>加载</button>
          <button onClick={handleExport} style={btnStyle}>保存(导出下载)</button>
          <button onClick={wf.doAutoLayout} style={btnStyle}>整理布局</button>
          <button onClick={wf.validate} style={{ ...btnStyle, background: "#EF4444" }}>校验</button>
        </div>
      </div>
      <div
        style={{
          minHeight: 32,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: "#E2E8F0",
          color: "#334155",
          fontSize: 12,
          borderBottom: "1px solid #CBD5E1",
        }}
      >
        <span>节点数: {wf.model.nodes.length}</span>
        <span>边数: {wf.model.edges.length}</span>
        <span>入口: {wf.model.entryNodeId ?? "未设置"}</span>
        <span style={{ color: "#475569" }}>最近动作: {wf.lastAction}</span>
      </div>

      {/* Main: three-column layout */}
      <div style={{ height: "calc(100vh - 80px)", display: "flex", overflow: "hidden" }}>
        <NodePalette onAddNode={wf.addNode} />
        <div style={{ flex: 1, height: "100%" }}>
          <Canvas
            model={wf.model}
            onNodesChange={(nodes) => {
              for (const n of nodes) {
                wf.updateNodePosition(n.id, n.position);
              }
            }}
            onEdgesChange={(edges) => {
              const nextEdgeIds = new Set(edges.map(edge => edge.id));
              for (const edge of wf.model.edges) {
                if (!nextEdgeIds.has(edge.id)) {
                  wf.removeEdge(edge.id);
                }
              }
            }}
            onConnect={handleConnect}
            onNodeClick={wf.selectNode}
            onPaneClick={() => wf.selectNode(null)}
            onNodeDelete={wf.removeNode}
            onEdgeDelete={wf.removeEdge}
            onDropNode={handleDropNode}
          />
        </div>
        <PropertyPanel
          node={wf.selectedNode}
          allNodeIds={wf.model.nodes.map(n => n.id)}
          onUpdate={wf.updateNodeData}
          onDelete={wf.removeNode}
          onSetEntry={handleSetEntry}
          isEntry={wf.selectedNodeId === wf.model.entryNodeId}
        />
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "5px 14px", background: "#334155", color: "#E2E8F0",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12,
};
