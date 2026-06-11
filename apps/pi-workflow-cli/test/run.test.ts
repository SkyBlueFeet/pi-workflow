import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  buildPwbFromDirectory: vi.fn(),
  dslToIr: vi.fn(),
  loadPwbFile: vi.fn(),
}));

const runtimeContextMocks = vi.hoisted(() => ({
  createWorkflowRuntimeContext: vi.fn(),
}));

const runnerMocks = vi.hoisted(() => ({
  runWorkflowWithShell: vi.fn(),
}));

const helperMocks = vi.hoisted(() => ({
  buildPwbFromDocument: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  buildPwbFromDirectory: coreMocks.buildPwbFromDirectory,
  dslToIr: coreMocks.dslToIr,
  loadPwbFile: coreMocks.loadPwbFile,
}));

vi.mock("../src/runtime/create-workflow-runtime-context.js", () => ({
  createWorkflowRuntimeContext: runtimeContextMocks.createWorkflowRuntimeContext,
}));

vi.mock("../src/workflow-runner/workflow-runner.js", () => ({
  runWorkflowWithShell: runnerMocks.runWorkflowWithShell,
}));

vi.mock("../src/commands/build-helper.js", () => ({
  buildPwbFromDocument: helperMocks.buildPwbFromDocument,
}));

vi.mock("node:fs", () => fsMocks);

describe("runCommand", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["PI_WORKFLOW_DEFAULT_MODEL"];
    coreMocks.buildPwbFromDirectory.mockReset();
    coreMocks.dslToIr.mockReset();
    coreMocks.loadPwbFile.mockReset();
    runtimeContextMocks.createWorkflowRuntimeContext.mockReset();
    runnerMocks.runWorkflowWithShell.mockReset();
    helperMocks.buildPwbFromDocument.mockReset();
    fsMocks.existsSync.mockReset();
    fsMocks.statSync.mockReset();
    fsMocks.readFileSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.unlinkSync.mockReset();
    runtimeContextMocks.createWorkflowRuntimeContext.mockResolvedValue({
      runtime: { run: vi.fn() },
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

  it("run --dir 在加载失败退出前会清理临时 bundle", async () => {
    const { runCommand } = await import("../src/commands/run.js");

    coreMocks.buildPwbFromDirectory.mockReturnValue({
      diagnostics: [],
      pwbData: Buffer.from("bundle-data"),
    });
    coreMocks.loadPwbFile.mockReturnValue({
      document: { id: "wf", version: "1", title: "wf", entry: "n1", nodes: [] },
      diagnostics: [{ severity: "error", code: "BUNDLE-006", message: "document.json 哈希值不匹配" }],
    });
    fsMocks.existsSync.mockImplementation((path: string) => path.endsWith(".tmp.pwb"));

    await expect(runCommand(["--dir", "workflow-dir"])).rejects.toMatchObject({ message: "RUN_EXIT:1" });

    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(expect.stringContaining("workflow-dir.tmp.pwb"), expect.any(Buffer));
    expect(fsMocks.unlinkSync).toHaveBeenCalledWith(expect.stringContaining("workflow-dir.tmp.pwb"));
  });

  it("纯 tool 工作流也会创建真实 PI Host 上下文并交给统一 runner", async () => {
    const { runCommand } = await import("../src/commands/run.js");

    coreMocks.loadPwbFile.mockReturnValue({
      document: { id: "wf", version: "1", title: "wf", entry: "tool1", nodes: [] },
      diagnostics: [],
    });
    coreMocks.dslToIr.mockReturnValue({
      id: "wf",
      version: "1",
      title: "wf",
      entryNodeIds: ["tool1"],
      nodes: [{ id: "tool1", title: "Tool", kind: "tool", dependsOn: [], inputBindings: {} }],
      edges: [],
    });

    await runCommand(["workflow.pwb"]);

    expect(runtimeContextMocks.createWorkflowRuntimeContext).toHaveBeenCalledWith(expect.objectContaining({
      ir: expect.objectContaining({
        nodes: [expect.objectContaining({ kind: "tool" })],
      }),
    }));
    expect(runnerMocks.runWorkflowWithShell).toHaveBeenCalledWith(expect.objectContaining({
      title: "wf",
    }));
  });
});
