import { describe, expect, it } from "vitest";
import { mapRuntimeEventToDisplayEvents } from "../src/display/workflow-display-events.js";

describe("workflow display events", () => {
  it("将 runtime 节点事件映射为展示协议事件", () => {
    const displayEvents = mapRuntimeEventToDisplayEvents({
      type: "node.started",
      workflowRunId: "run-1",
      nodeId: "analyze",
      title: "分析节点",
    });

    expect(displayEvents).toEqual([{
      type: "display.node.started",
      workflowRunId: "run-1",
      nodeId: "analyze",
      title: "分析节点",
    }]);
  });

  it("忽略不需要暴露给显示层的底层事件", () => {
    const displayEvents = mapRuntimeEventToDisplayEvents({
      type: "frame.entered",
      workflowRunId: "run-1",
      frameId: "frame-1",
      frameType: "subworkflow",
    });

    expect(displayEvents).toEqual([]);
  });
});
