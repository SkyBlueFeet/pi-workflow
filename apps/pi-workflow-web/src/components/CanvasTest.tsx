/**
 * 最小化 ReactFlow 测试组件 —— 用于排查画布不渲染问题。
 * 使用固定像素高度、内联节点类型，完全独立于其他组件。
 */
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const TEST_NODES: Node[] = [
  { id: "n1", position: { x: 80, y: 80 }, data: { label: "开始节点" } },
  { id: "n2", position: { x: 300, y: 80 }, data: { label: "中间节点" } },
  { id: "n3", position: { x: 300, y: 220 }, data: { label: "结束节点" } },
];

const TEST_EDGES: Edge[] = [
  { id: "e1-2", source: "n1", target: "n2" },
  { id: "e2-3", source: "n2", target: "n3" },
];

export default function CanvasTest() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          height: 40,
          background: "#1E293B",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        CanvasTest — ReactFlow 独立测试 (固定像素高度)
      </div>

      {/* ReactFlow 区域：用 calc 给明确像素高度，避免 height:100% 链断裂 */}
      <div style={{ width: "100%", height: "calc(100vh - 40px)", flexShrink: 0 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={TEST_NODES}
            edges={TEST_EDGES}
            fitView
            style={{ width: "100%", height: "100%" }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
