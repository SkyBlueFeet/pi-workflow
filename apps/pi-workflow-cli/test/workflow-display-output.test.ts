import { describe, expect, it, vi } from "vitest";
import { WorkflowProgressRenderer } from "../src/display/workflow-progress-renderer.js";

describe("workflow display final output", () => {
  it("未开启 showFinalOutput 时不打印结果块", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const renderer = new WorkflowProgressRenderer();

    renderer.renderEvent(
      {
        type: "display.workflow.completed",
        workflowRunId: "run-1",
        finalOutput: { ok: true },
      },
      {
        workflowRunId: "run-1",
        workflowId: "wf",
        title: "wf",
        status: "completed",
        nodeStates: [],
        finalOutput: { ok: true },
      },
    );

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("结果:"))).toBe(false);
    logSpy.mockRestore();
  });

  it("开启 showFinalOutput 时打印结果块", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const renderer = new WorkflowProgressRenderer({ showFinalOutput: true });

    renderer.renderEvent(
      {
        type: "display.workflow.completed",
        workflowRunId: "run-1",
        finalOutput: { ok: true },
      },
      {
        workflowRunId: "run-1",
        workflowId: "wf",
        title: "wf",
        status: "completed",
        nodeStates: [],
        finalOutput: { ok: true },
      },
    );

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("结果:"))).toBe(true);
    logSpy.mockRestore();
  });
});
