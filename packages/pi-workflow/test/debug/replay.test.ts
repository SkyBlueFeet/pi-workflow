import { describe, it, expect } from "vitest";
import { WorkflowReplay, WorkflowRuntimeEvent } from "../../src/index.js";

describe("WorkflowReplay", () => {
  it("可从事件列表创建 replay 实例", () => {
    const replay = new WorkflowReplay([]);
    expect(replay.getTrace()).toBeDefined();
  });

  it("replayAll 返回每个事件为一步的帧列表", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "node-1" },
    ];
    const replay = new WorkflowReplay(events);
    const frames = replay.replayAll();

    expect(frames).toHaveLength(2);
    expect(frames[0].index).toBe(0);
    expect(frames[1].index).toBe(1);
    expect(frames[1].nodeStates).toHaveLength(1);
  });

  it("replayToEvent 回放到指定事件", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "node-1" },
      { type: "node.completed", workflowRunId: "run-1", nodeId: "node-1" },
    ];
    const replay = new WorkflowReplay(events);
    const frame = replay.replayToEvent(1);

    expect(frame.events).toHaveLength(2);
    expect(frame.index).toBe(1);
  });

  it("getNodeTimeline 返回指定节点的所有事件", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "node-1" },
      { type: "node.progress", workflowRunId: "run-1", nodeId: "node-1", message: "working" },
      { type: "node.completed", workflowRunId: "run-1", nodeId: "node-1" },
    ];
    const replay = new WorkflowReplay(events);
    const timeline = replay.getNodeTimeline("node-1");

    expect(timeline).toHaveLength(3);
    expect(timeline[0].type).toBe("node.started");
    expect(timeline[1].type).toBe("node.progress");
    expect(timeline[2].type).toBe("node.completed");
  });
});
