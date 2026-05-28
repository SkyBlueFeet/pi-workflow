import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyCommand } from "../src/commands/policy.js";

const coreMocks = vi.hoisted(() => ({
  mockLoadWorkflowConfigFile: vi.fn(),
  mockValidateWorkflowConfig: vi.fn(),
  mockLoadFromDirectory: vi.fn(),
  mockLoadFromObject: vi.fn(),
  mockDslToIr: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  loadWorkflowConfigFile: coreMocks.mockLoadWorkflowConfigFile,
  validateWorkflowConfig: coreMocks.mockValidateWorkflowConfig,
  loadFromDirectory: coreMocks.mockLoadFromDirectory,
  loadFromObject: coreMocks.mockLoadFromObject,
  dslToIr: coreMocks.mockDslToIr,
}));

vi.mock("node:fs", () => ({
  statSync: vi.fn(() => ({ isDirectory: () => true })),
  readFileSync: vi.fn(() => JSON.stringify({})),
}));

describe("policyCommand", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("show 输出 security 配置", async () => {
    coreMocks.mockLoadWorkflowConfigFile.mockReturnValue({
      config: { security: { permissions: [{ capability: "workflow.invoke" }] } },
      baseDir: "E:/repo",
    });

    await policyCommand(["show", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ permissions: [{ capability: "workflow.invoke" }] }, null, 2));
  });

  it("show 在未声明 security 时输出默认说明", async () => {
    coreMocks.mockLoadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });

    await policyCommand(["show", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("默认拒绝策略"));
  });

  it("check 预检失败时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);
    coreMocks.mockLoadWorkflowConfigFile.mockReturnValue({ config: { baseDir: "E:/repo" }, baseDir: "E:/repo" });
    coreMocks.mockLoadFromDirectory.mockReturnValue({ document: { id: "wf" }, diagnostics: [] });
    coreMocks.mockDslToIr.mockReturnValue({ id: "wf", nodes: [], edges: [], entryNodeIds: [], version: "1" });
    coreMocks.mockValidateWorkflowConfig.mockReturnValue({
      valid: false,
      errors: [{ nodeId: "config", field: "security.permissions", message: "缺少授权" }],
    });

    await expect(policyCommand(["check", "workflow", "--config", "workflow.toml"]))
      .rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalledWith("[预检失败] [config] security.permissions: 缺少授权");
    exitSpy.mockRestore();
  });

  it("check 预检通过时输出成功信息", async () => {
    coreMocks.mockLoadWorkflowConfigFile.mockReturnValue({ config: { baseDir: "E:/repo" }, baseDir: "E:/repo" });
    coreMocks.mockLoadFromDirectory.mockReturnValue({ document: { id: "wf" }, diagnostics: [] });
    coreMocks.mockDslToIr.mockReturnValue({ id: "wf", nodes: [], edges: [], entryNodeIds: [], version: "1" });
    coreMocks.mockValidateWorkflowConfig.mockReturnValue({ valid: true, errors: [] });

    await policyCommand(["check", "workflow", "--config", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith("安全预检通过");
  });
});
