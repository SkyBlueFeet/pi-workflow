import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "../src/commands/run.js";

const coreMocks = vi.hoisted(() => ({
  buildPwbFromDirectory: vi.fn(),
  buildPwbFromDocument: vi.fn(),
  loadPwbFile: vi.fn(),
  dslToIr: vi.fn(),
  WorkflowRuntime: vi.fn(),
  ExecutorRegistry: vi.fn(),
  ManualExecutor: vi.fn(),
  ReturnExecutor: vi.fn(),
  UnsupportedExecutor: vi.fn(),
  AgentExecutor: vi.fn(),
  ToolExecutor: vi.fn(),
  HttpExecutor: vi.fn(),
  ExtractorExecutor: vi.fn(),
  FileWorkflowRunStore: vi.fn(),
  MockPiHostAdapter: vi.fn(),
  PiHostAdapter: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
  evaluateCapability: vi.fn(),
  ALL_CAPABILITIES: [],
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
  buildPwbFromDocument: coreMocks.buildPwbFromDocument,
  loadPwbFile: coreMocks.loadPwbFile,
  dslToIr: coreMocks.dslToIr,
  WorkflowRuntime: coreMocks.WorkflowRuntime,
  ExecutorRegistry: coreMocks.ExecutorRegistry,
  ManualExecutor: coreMocks.ManualExecutor,
  ReturnExecutor: coreMocks.ReturnExecutor,
  UnsupportedExecutor: coreMocks.UnsupportedExecutor,
  AgentExecutor: coreMocks.AgentExecutor,
  ToolExecutor: coreMocks.ToolExecutor,
  HttpExecutor: coreMocks.HttpExecutor,
  ExtractorExecutor: coreMocks.ExtractorExecutor,
  FileWorkflowRunStore: coreMocks.FileWorkflowRunStore,
  MockPiHostAdapter: coreMocks.MockPiHostAdapter,
  PiHostAdapter: coreMocks.PiHostAdapter,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
  evaluateCapability: coreMocks.evaluateCapability,
  ALL_CAPABILITIES: coreMocks.ALL_CAPABILITIES,
}));

vi.mock("@pi-workflow/extension-loader", () => ({
  PiExtensionBridge: vi.fn(() => ({
    getNativeTools: () => [],
    loadFromNodeModules: async () => [],
    getAllTools: () => [],
  })),
}));

vi.mock("@pi-workflow/builtin-tools", () => ({
  registerBuiltinTools: vi.fn(() => []),
}));

vi.mock("node:fs", () => fsMocks);

describe("runCommand", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.buildPwbFromDirectory.mockReset();
    coreMocks.buildPwbFromDocument.mockReset();
    coreMocks.loadPwbFile.mockReset();
    coreMocks.dslToIr.mockReset();
    fsMocks.existsSync.mockReset();
    fsMocks.statSync.mockReset();
    fsMocks.readFileSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.unlinkSync.mockReset();
    coreMocks.WorkflowRuntime.mockImplementation(() => ({
      async *run() {
        yield { type: "workflow.completed", finalOutput: {} };
      },
    }));
    coreMocks.ExecutorRegistry.mockImplementation(() => ({
      register: vi.fn(),
    }));
    coreMocks.ManualExecutor.mockImplementation(() => ({}));
    coreMocks.ReturnExecutor.mockImplementation(() => ({}));
    coreMocks.UnsupportedExecutor.mockImplementation(() => ({}));
    coreMocks.AgentExecutor.mockImplementation(() => ({}));
    coreMocks.ToolExecutor.mockImplementation(() => ({}));
    coreMocks.HttpExecutor.mockImplementation(() => ({}));
    coreMocks.ExtractorExecutor.mockImplementation(() => ({}));
    coreMocks.FileWorkflowRunStore.mockImplementation(() => ({}));
    coreMocks.PiHostAdapter.mockImplementation((options) => ({ options }));
    coreMocks.evaluateCapability.mockReturnValue({ allowed: true, reason: "ok" });
  });

  it("run --dir 在加载失败退出前会清理临时 bundle", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    coreMocks.buildPwbFromDirectory.mockReturnValue({
      diagnostics: [],
      pwbData: Buffer.from("bundle-data"),
    });
    coreMocks.loadPwbFile.mockReturnValue({
      document: null,
      diagnostics: [{ severity: "error", code: "BUNDLE-006", message: "document.json 哈希值不匹配" }],
    });
    fsMocks.existsSync.mockImplementation((path: string) => path.endsWith(".tmp.pwb"));

    await expect(runCommand(["--dir", "workflow-dir"])).rejects.toThrow("EXIT:1");

    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(expect.stringContaining("workflow-dir.tmp.pwb"), expect.any(Buffer));
    expect(fsMocks.unlinkSync).toHaveBeenCalledWith(expect.stringContaining("workflow-dir.tmp.pwb"));

    exitSpy.mockRestore();
  });

  it("纯 tool 工作流也会创建真实 PI Host 以启用宿主工具", async () => {
    coreMocks.loadPwbFile.mockReturnValue({
      document: { id: "wf", title: "wf" },
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

    expect(coreMocks.PiHostAdapter).toHaveBeenCalled();
    expect(coreMocks.WorkflowRuntime).toHaveBeenCalledWith(expect.objectContaining({
      host: expect.any(Object),
    }));
  });
});
