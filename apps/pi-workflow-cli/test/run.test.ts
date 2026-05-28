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
  FileWorkflowRunStore: vi.fn(),
  MockPiHostAdapter: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
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
  FileWorkflowRunStore: coreMocks.FileWorkflowRunStore,
  MockPiHostAdapter: coreMocks.MockPiHostAdapter,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
  ALL_CAPABILITIES: coreMocks.ALL_CAPABILITIES,
}));

vi.mock("node:fs", () => fsMocks);

describe("runCommand", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
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
});
