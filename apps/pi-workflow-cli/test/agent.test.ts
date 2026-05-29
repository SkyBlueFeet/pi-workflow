import { beforeEach, describe, expect, it, vi } from "vitest";
import * as readline from "node:readline";
import { agentCommand } from "../src/commands/agent.js";

const coreMocks = vi.hoisted(() => ({
  createRegistryFromConfig: vi.fn(),
  resolveAgentConfig: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
  CustomAgentInvoker: vi.fn(),
  PiHostAdapter: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  createRegistryFromConfig: coreMocks.createRegistryFromConfig,
  resolveAgentConfig: coreMocks.resolveAgentConfig,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
  CustomAgentInvoker: coreMocks.CustomAgentInvoker,
  PiHostAdapter: coreMocks.PiHostAdapter,
}));

vi.mock("node:readline", () => ({
  createInterface: vi.fn(),
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

  it("run 流式输出智能体执行结果", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({ config: {}, baseDir: "E:/repo" });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "writer",
    });
    coreMocks.PiHostAdapter.mockImplementation(() => ({}));
    coreMocks.CustomAgentInvoker.mockImplementation(function (this: any) {
      this.invoke = async function* () {
        yield { type: "agent.text_delta" as const, delta: "Hello" };
        yield { type: "agent.text_delta" as const, delta: " World" };
      };
    });

    await agentCommand(["run", "writer", "--config", "workflow.toml"]);

    expect(writeSpy).toHaveBeenCalledWith("Hello");
    expect(writeSpy).toHaveBeenCalledWith(" World");
    writeSpy.mockRestore();
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

  it("run 无效 input.json 时退出", async () => {
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

  it("chat 第二轮将历史消息作为文本块传递", async () => {
    const questionMock = vi.fn<(query: string, callback: (answer: string) => void) => void>()
      .mockImplementationOnce((_query, callback) => callback("hi"))
      .mockImplementationOnce((_query, callback) => callback("你好"))
      .mockImplementationOnce((_query, callback) => callback("/exit"));
    const closeMock = vi.fn();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const capturedRequests: Array<Record<string, unknown>> = [];

    vi.mocked(readline.createInterface).mockReturnValue({
      question: questionMock,
      close: closeMock,
    } as unknown as readline.Interface);

    coreMocks.loadWorkflowConfigFile.mockReturnValue({
      config: {
        model: { provider: "deepseek", model: "deepseek-v4-flash" },
        agents: { assistant: { name: "测试助手", systemPrompt: "你是助手" } },
      },
      baseDir: "E:/repo",
    });
    coreMocks.createRegistryFromConfig.mockReturnValue({
      has: (id: string) => id === "assistant",
      get: () => ({ name: "测试助手", systemPrompt: "你是助手" }),
    });
    coreMocks.PiHostAdapter.mockImplementation(() => ({}));
    coreMocks.CustomAgentInvoker.mockImplementation(function (this: any) {
      this.invoke = async function* (request: Record<string, unknown>) {
        capturedRequests.push(request);
        yield {
          type: "agent.text_delta" as const,
          delta: capturedRequests.length === 1 ? "第一轮回复" : "第二轮回复",
        };
      };
    });

    await agentCommand(["chat", "assistant", "--config", "workflow.toml"]);

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[1]?.initialMessages).toEqual([
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [{ type: "text", text: "第一轮回复" }] },
    ]);
    expect(writeSpy).toHaveBeenCalledWith("第一轮回复");
    expect(writeSpy).toHaveBeenCalledWith("第二轮回复");

    writeSpy.mockRestore();
  });
});
