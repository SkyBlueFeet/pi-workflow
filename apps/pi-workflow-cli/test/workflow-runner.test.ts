import { describe, expect, it, vi } from "vitest";
import { runWorkflowWithShell } from "../src/workflow-runner/workflow-runner.js";

describe("workflow runner", () => {
  it("驱动 resume 并返回成功退出码", async () => {
    const runtime = {
      resume: vi.fn(async function* () {
        yield { type: "workflow.resumed", workflowRunId: "run-1", workflowId: "wf" };
        yield { type: "workflow.completed", workflowRunId: "run-1", finalOutput: { ok: true } };
        return { finalOutput: { ok: true } };
      }),
    };

    const result = await runWorkflowWithShell({
      runtime: runtime as never,
      state: {
        workflowRunId: "run-1",
        workflowId: "wf",
        status: "paused",
        frames: [],
        currentFrameId: "frame-1",
        completedNodeIds: [],
        nodeResults: {},
        sharedContext: {},
        workflowInput: {},
        artifacts: [],
        ir: {
          id: "wf",
          version: "1",
          title: "wf",
          entryNodeIds: [],
          nodes: [],
          edges: [],
        },
        resumePolicy: "reenter-node",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      interactionInput: {},
      title: "wf",
    });

    expect(runtime.resume).toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.result.finalOutput).toEqual({ ok: true });
  });

  it("遇到 workflow.failed 时返回失败退出码", async () => {
    const runtime = {
      run: vi.fn(async function* () {
        yield { type: "workflow.started", workflowRunId: "run-2", workflowId: "wf" };
        yield { type: "workflow.failed", workflowRunId: "run-2", error: "boom" };
        return { finalOutput: { error: "boom" } };
      }),
    };

    const result = await runWorkflowWithShell({
      runtime: runtime as never,
      ir: {
        id: "wf",
        version: "1",
        title: "wf",
        entryNodeIds: [],
        nodes: [],
        edges: [],
      },
      input: {},
      title: "wf",
    });

    expect(runtime.run).toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.result.finalOutput).toEqual({ error: "boom" });
  });
});
