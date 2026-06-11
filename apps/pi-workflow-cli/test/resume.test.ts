import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  FileWorkflowRunStore: vi.fn(),
}));

const runtimeContextMocks = vi.hoisted(() => ({
  createWorkflowRuntimeContext: vi.fn(),
}));

const runnerMocks = vi.hoisted(() => ({
  runWorkflowWithShell: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  FileWorkflowRunStore: coreMocks.FileWorkflowRunStore,
}));

vi.mock("../src/runtime/create-workflow-runtime-context.js", () => ({
  createWorkflowRuntimeContext: runtimeContextMocks.createWorkflowRuntimeContext,
}));

vi.mock("../src/workflow-runner/workflow-runner.js", () => ({
  runWorkflowWithShell: runnerMocks.runWorkflowWithShell,
}));

vi.mock("node:fs", () => fsMocks);

describe("resumeCommand", () => {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`EXIT:${code}`);
  }) as never);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.FileWorkflowRunStore.mockImplementation(() => ({
      loadRunState: vi.fn().mockResolvedValue({
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
      }),
    }));
    runtimeContextMocks.createWorkflowRuntimeContext.mockResolvedValue({
      runtime: { resume: vi.fn() },
      store: {},
      host: {},
      executorRegistry: {},
      config: {},
      metadata: { isMock: false, scannedExtensions: false, registeredToolCount: 1, mode: "live" },
    });
    runnerMocks.runWorkflowWithShell.mockResolvedValue({
      exitCode: 0,
      result: { finalOutput: {} },
    });
  });

  it("resume 使用统一 runtime context 与 runner 恢复 paused 工作流", async () => {
    const { resumeCommand } = await import("../src/commands/resume.js");

    await resumeCommand(["run-1"]);

    expect(runtimeContextMocks.createWorkflowRuntimeContext).toHaveBeenCalledWith(expect.objectContaining({
      ir: expect.objectContaining({ id: "wf" }),
    }));
    expect(runnerMocks.runWorkflowWithShell).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.objectContaining({ workflowRunId: "run-1" }),
      title: "wf",
    }));
  });

  it("resume 在状态不存在时退出", async () => {
    const { resumeCommand } = await import("../src/commands/resume.js");
    coreMocks.FileWorkflowRunStore.mockImplementation(() => ({
      loadRunState: vi.fn().mockResolvedValue(undefined),
    }));

    await expect(resumeCommand(["missing-run"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });
});
