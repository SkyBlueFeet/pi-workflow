import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentCommand } from "../src/commands/agent.js";

const coreMocks = vi.hoisted(() => ({
  createRegistryFromConfig: vi.fn(),
  resolveAgentConfig: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
  CustomAgentInvoker: vi.fn(),
  PiHostAdapter: vi.fn(),
  runResolvedAssemblyInPiTui: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  createRegistryFromConfig: coreMocks.createRegistryFromConfig,
  resolveAgentConfig: coreMocks.resolveAgentConfig,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
  CustomAgentInvoker: coreMocks.CustomAgentInvoker,
  PiHostAdapter: coreMocks.PiHostAdapter,
  runResolvedAssemblyInPiTui: coreMocks.runResolvedAssemblyInPiTui,
}));

describe("agentCommand", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["PI_WORKFLOW_TEST_MODEL"];
  });

  it("list 输出智能体摘要", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      list: () => [{
        id: "writer",
        name: "Writer",
        description: "Writes",
        skills: [{ name: "outline" }],
        tools: [],
        workflowOverlay: { workflowTools: {} },
        runtimeMode: "pi-tui",
        diagnostics: [],
        mcp: [],
      }],
    });

    await agentCommand(["list", "--config", "workflow.toml"]);

    expect(logSpy).toHaveBeenCalledWith("已配置的智能体:");
    expect(logSpy).toHaveBeenCalledWith("  writer");
  });

  it("show 输出指定智能体详情", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      get: (id: string) => id === "writer"
        ? {
            id: "writer",
            systemPrompt: "You are writer.",
            model: { provider: "openai", model: "gpt-4o-mini" },
            workflowOverlay: { workflowTools: {} },
            runtimeMode: "pi-tui",
            diagnostics: [],
          }
        : undefined,
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
      prompt: {
        systemPrompt: "You are writer.",
        userPrompt: "Write a summary",
      },
      model: { id: "openai/gpt-4o-mini", provider: "openai", name: "gpt-4o-mini", temperature: 0.5, maxTokens: 1024 },
      skills: [{ name: "outline" }],
      tools: [{ name: "search", type: "native" }],
      workflowTools: [],
      executableTools: [],
      mcp: [{ server: "ctx7" }],
      permissions: [{ capability: "workflow.invoke" }],
      runtimeMode: "pi-tui",
      diagnostics: [],
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

  it("run 默认进入 pi-tui 运行面", async () => {
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });
    coreMocks.resolveAgentConfig.mockReturnValue({
      id: "writer",
      prompt: { systemPrompt: "You are writer.", userPrompt: "hello" },
      model: { id: "openai/gpt-4o-mini", provider: "openai", name: "gpt-4o-mini" },
      skills: [],
      tools: [],
      executableTools: [],
      workflowTools: [],
      mcp: [],
      permissions: [],
      runtimeMode: "pi-tui",
      diagnostics: [],
    });
    coreMocks.runResolvedAssemblyInPiTui.mockResolvedValue({ runtimeHost: {}, diagnostics: [] });

    await agentCommand(["run", "writer", "--config", "workflow.toml"]);

    expect(coreMocks.resolveAgentConfig).toHaveBeenCalled();
    expect(coreMocks.runResolvedAssemblyInPiTui).toHaveBeenCalled();
  });

  it("run 在传入位置参数时提示改用 once", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });

    await expect(agentCommand(["run", "writer", "bad.json", "--config", "workflow.toml"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("run 缺少 --config 时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    await expect(agentCommand(["run", "writer"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("run 智能体不存在时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: () => false,
    });

    await expect(agentCommand(["run", "missing", "--config", "workflow.toml"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("once 用 --prompt 单轮执行", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });
    coreMocks.resolveAgentConfig.mockReturnValue({
      id: "writer",
      prompt: { systemPrompt: "You are writer." },
      model: { id: "openai/gpt-4o-mini", provider: "openai", name: "gpt-4o-mini" },
      skills: [],
      tools: [],
      executableTools: [],
      workflowTools: [],
      mcp: [],
      permissions: [],
      runtimeMode: "pi-tui",
      diagnostics: [],
    });
    coreMocks.PiHostAdapter.mockImplementation(() => ({}));
    coreMocks.CustomAgentInvoker.mockImplementation(function (this: any) {
      this.invoke = async function* (request: Record<string, unknown>) {
        expect(request.prompt).toBe("hello");
        yield { type: "agent.text_delta" as const, delta: "done" };
      };
    });

    await agentCommand(["once", "writer", "--config", "workflow.toml", "--prompt", "hello"]);

    expect(writeSpy).toHaveBeenCalledWith("done");
    writeSpy.mockRestore();
  });

  it("run 在未显式指定 --model 时使用测试模型环境变量", async () => {
    process.env["PI_WORKFLOW_TEST_MODEL"] = "deepseek/deepseek-v4-flash";
    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });
    coreMocks.resolveAgentConfig.mockReturnValue({
      id: "writer",
      prompt: { systemPrompt: "You are writer." },
      model: { id: "openai/gpt-4o-mini", provider: "openai", name: "gpt-4o-mini" },
      skills: [],
      tools: [],
      executableTools: [],
      workflowTools: [],
      mcp: [],
      permissions: [],
      runtimeMode: "pi-tui",
      diagnostics: [],
    });
    coreMocks.runResolvedAssemblyInPiTui.mockResolvedValue({ runtimeHost: {}, diagnostics: [] });

    await agentCommand(["run", "writer", "--config", "workflow.toml"]);

    expect(coreMocks.runResolvedAssemblyInPiTui).toHaveBeenCalledWith(expect.objectContaining({
      assembly: expect.objectContaining({
        model: expect.objectContaining({
          id: "deepseek/deepseek-v4-flash",
          provider: "deepseek",
          name: "deepseek-v4-flash",
        }),
      }),
    }));
  });

  it("once 同时指定 --prompt 和 --input 时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });

    await expect(agentCommand([
      "once",
      "writer",
      "--config",
      "workflow.toml",
      "--prompt",
      "hello",
      "--input",
      "bad.json",
    ])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("once 缺少显式输入时退出", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });

    await expect(agentCommand(["once", "writer", "--config", "workflow.toml"])).rejects.toThrow("EXIT:1");
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
