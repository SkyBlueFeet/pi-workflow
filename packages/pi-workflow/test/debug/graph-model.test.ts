import { describe, it, expect } from "vitest";
import { buildGraphViewModel, WorkflowDefinitionIR, WorkflowRuntimeEvent } from "../../src/index.js";

describe("buildGraphViewModel", () => {
  const ir: WorkflowDefinitionIR = {
    id: "test-flow",
    version: "1.0",
    title: "Test",
    entryNodeIds: ["start"],
    nodes: [
      { id: "start", title: "Start", kind: "manual", dependsOn: [], inputBindings: {} },
      { id: "finish", title: "Finish", kind: "return", dependsOn: ["start"], inputBindings: {} },
    ],
    edges: [
      { from: "start", to: "finish" },
    ],
  };

  it("从 IR 和事件构建图模型", () => {
    const events: WorkflowRuntimeEvent[] = [
      { type: "workflow.started", workflowRunId: "run-1", workflowId: "test-flow" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "start", title: "Start" },
      { type: "node.completed", workflowRunId: "run-1", nodeId: "start" },
      { type: "node.started", workflowRunId: "run-1", nodeId: "finish", title: "Finish" },
      { type: "node.completed", workflowRunId: "run-1", nodeId: "finish" },
      { type: "workflow.completed", workflowRunId: "run-1", finalOutput: {} },
    ];

    const graph = buildGraphViewModel(ir, events);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);

    const startNode = graph.nodes.find(n => n.id === "start");
    expect(startNode?.status).toBe("completed");
    expect(startNode?.kind).toBe("manual");

    const finishNode = graph.nodes.find(n => n.id === "finish");
    expect(finishNode?.status).toBe("completed");
  });

  it("未出现在事件中的节点状态为 pending", () => {
    const graph = buildGraphViewModel(ir, []);
    const startNode = graph.nodes.find(n => n.id === "start");
    expect(startNode?.status).toBe("pending");
  });
});
