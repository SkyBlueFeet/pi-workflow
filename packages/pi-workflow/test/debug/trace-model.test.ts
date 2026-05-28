import { describe, it, expect } from "vitest";
import { buildTrace, WorkflowRuntimeEvent } from "../../src/index.js";

describe("buildTrace", () => {
  it("从空事件列表生成空 trace", () => {
    const trace = buildTrace([]);
    expect(trace.workflowRunId).toBe("");
    expect(trace.events).toHaveLength(0);
    expect(trace.nodes).toHaveLength(0);
    expect(trace.frames).toHaveLength(0);
  });

  it("从 workflow.started 事件提取 runId 和 workflowId", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow", timestamp: "2026-01-01T00:00:00.000Z" },
    ];
    const trace = buildTrace(events);
    expect(trace.workflowRunId).toBe("run-1");
    expect(trace.workflowId).toBe("test-flow");
    expect(trace.startedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("跟踪节点状态变化", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "node-1", title: "Node 1" },
      { type: "node.completed", workflowRunId: "run-1", nodeId: "node-1" },
      { type: "workflow.completed", workflowRunId: "run-1", finalOutput: {} },
    ];
    const trace = buildTrace(events);

    expect(trace.status).toBe("completed");
    expect(trace.nodes).toHaveLength(1);
    expect(trace.nodes[0].nodeId).toBe("node-1");
    expect(trace.nodes[0].status).toBe("completed");
    expect(trace.nodes[0].title).toBe("Node 1");
  });

  it("跟踪节点失败", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "node-1" },
      { type: "node.failed", workflowRunId: "run-1", nodeId: "node-1", error: "timeout" },
      { type: "workflow.failed", workflowRunId: "run-1", error: "timeout" },
    ];
    const trace = buildTrace(events);

    expect(trace.status).toBe("failed");
    expect(trace.nodes[0].status).toBe("failed");
    expect(trace.nodes[0].error).toBe("timeout");
  });

  it("跟踪 frame 进入/完成", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "frame.entered", workflowRunId: "run-1", frameId: "frame-1", frameType: "root" },
      { type: "frame.completed", workflowRunId: "run-1", frameId: "frame-1" },
      { type: "workflow.completed", workflowRunId: "run-1", finalOutput: {} },
    ];
    const trace = buildTrace(events);

    expect(trace.frames).toHaveLength(1);
    expect(trace.frames[0].frameId).toBe("frame-1");
  });
});
