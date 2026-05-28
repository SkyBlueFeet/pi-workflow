import { describe, it, expect } from "vitest";
import {
  AuthoringDryRunDiagnosticCodes,
  WorkflowDryRunner,
} from "../../src/index.js";

describe("WorkflowDryRunner", () => {
  it("可执行 deterministic workflow 并返回 runtime 事件", async () => {
    const runner = new WorkflowDryRunner();
    const result = await runner.runObject({
      id: "dry-run-flow",
      version: "1.0",
      title: "Dry Run Flow",
      entry: "collect",
      nodes: [
        {
          id: "collect",
          executor: { type: "manual" },
          inputs: { value: { from: "literal", value: 7 } },
          output: { to: "answer", mergeStrategy: "replace" },
        },
        {
          id: "finish",
          executor: { type: "return" },
          dependsOn: ["collect"],
          inputs: { result: { from: "context", path: "answer" } },
        },
      ],
    });

    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toHaveLength(0);
    expect(result.runtimeEvents.some(event => event.type === "workflow.completed")).toBe(true);
    expect(result.finalOutput).toEqual({ answer: { value: 7 } });
  });

  it("对不支持的节点类型输出 warning，但不阻塞返回结果", async () => {
    const runner = new WorkflowDryRunner();
    const result = await runner.runObject({
      id: "agent-flow",
      version: "1.0",
      title: "Agent Flow",
      entry: "draft",
      nodes: [
        {
          id: "draft",
          executor: { type: "agent" },
          inputs: { prompt: { from: "literal", value: "hello" } },
        },
      ],
    });

    expect(result.diagnostics.some(d => d.code === AuthoringDryRunDiagnosticCodes.UNSUPPORTED_NODE_KIND && d.nodeId === "draft")).toBe(true);
    expect(result.runtimeEvents).toHaveLength(0);
  });

  it("底层 lint 出现 error 时不会进入 runtime dry-run", async () => {
    const runner = new WorkflowDryRunner();
    const result = await runner.runObject({
      id: "broken-flow",
      version: "1.0",
      title: "Broken Flow",
      entry: "missing",
      nodes: [{ id: "only", executor: { type: "return" } }],
    });

    expect(result.diagnostics.some(d => d.severity === "error" && d.code === "DSL-005")).toBe(true);
    expect(result.runtimeEvents).toHaveLength(0);
  });
});
