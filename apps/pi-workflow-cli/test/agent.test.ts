import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentCommand } from "../src/commands/agent.js";

const coreMocks = vi.hoisted(() => ({
  createRegistryFromConfig: vi.fn(),
  resolveAgentConfig: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  createRegistryFromConfig: coreMocks.createRegistryFromConfig,
  resolveAgentConfig: coreMocks.resolveAgentConfig,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
}));

describe("agentCommand", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list 输出智能体摘要", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      list: () => [{ id: "writer", name: "Writer", description: "Writes", skills: [{ name: "outline" }], tools: [], workflowTools: {}, mcp: [] }],
    });

    await agentCommand(["list", "--config", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith("已配置的智能体:");
    expect(logSpy).toHaveBeenCalledWith("  writer");
  });

  it("show 输出指定智能体详情", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      get: (id: string) => id === "writer" ? { id: "writer", systemPrompt: "You are writer.", model: { provider: "openai", model: "gpt-4o-mini" } } : undefined,
    });

    await agentCommand(["show", "writer", "--config", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith("智能体: writer");
    expect(logSpy).toHaveBeenCalledWith("  模型: openai/gpt-4o-mini");
  });

  it("resolve 输出合并后的智能体配置", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });
    coreMocks.resolveAgentConfig.mockReturnValue({
      systemPrompt: "You are writer.",
      userPrompt: "Write a summary",
      model: { provider: "openai", model: "gpt-4o-mini" },
      temperature: 0.5,
      maxTokens: 1024,
      skills: [{ name: "outline" }],
      tools: [{ name: "search", source: "web" }],
      workflowTools: {},
      mcp: [{ server: "ctx7" }],
      permissions: [{ capability: "workflow.invoke" }],
    });

    await agentCommand(["resolve", "writer", "--config", "workflow.toml"]);

    expect(coreMocks.resolveAgentConfig).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("已解析智能体: writer");
    expect(logSpy).toHaveBeenCalledWith("  模型: openai/gpt-4o-mini");
  });

  it("resolve 在智能体不存在时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: () => false,
    });

    await expect(agentCommand(["resolve", "missing", "--config", "workflow.toml"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
