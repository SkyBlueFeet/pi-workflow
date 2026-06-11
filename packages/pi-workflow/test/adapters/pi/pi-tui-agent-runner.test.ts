import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ResolvedPiAgentAssembly } from "../../../src/agents/types.js";

const codingAgentMocks = vi.hoisted(() => ({
  createAgentSessionServices: vi.fn(),
  createAgentSessionFromServices: vi.fn(),
  createAgentSessionRuntime: vi.fn(),
  InteractiveMode: vi.fn(),
  SessionManager: {
    inMemory: vi.fn(),
  },
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices: codingAgentMocks.createAgentSessionServices,
  createAgentSessionFromServices: codingAgentMocks.createAgentSessionFromServices,
  createAgentSessionRuntime: codingAgentMocks.createAgentSessionRuntime,
  InteractiveMode: codingAgentMocks.InteractiveMode,
  SessionManager: codingAgentMocks.SessionManager,
}));

describe("runResolvedAssemblyInPiTui", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("使用 pi-coding-agent interactive mode 运行 resolved assembly", async () => {
    codingAgentMocks.createAgentSessionServices.mockResolvedValue({
      cwd: "E:/repo",
      agentDir: "E:/repo",
      diagnostics: [],
      modelRegistry: { find: vi.fn() },
    });
    codingAgentMocks.createAgentSessionFromServices.mockResolvedValue({
      session: {},
      extensionsResult: { extensions: [], errors: [], runtime: {} },
    });
    codingAgentMocks.SessionManager.inMemory.mockReturnValue({});
    codingAgentMocks.createAgentSessionRuntime.mockImplementation(async (factory: any, options: any) => {
      const created = await factory(options);
      return {
        diagnostics: created.diagnostics,
        session: created.session,
        dispose: vi.fn(),
      };
    });
    const runMock = vi.fn().mockResolvedValue(undefined);
    codingAgentMocks.InteractiveMode.mockImplementation(function (_runtimeHost: unknown, _options: unknown) {
      return { run: runMock };
    });

    const { runResolvedAssemblyInPiTui } = await import("../../../src/adapters/pi/pi-tui-agent-runner.js");
    const assembly: ResolvedPiAgentAssembly = {
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
    };

    await runResolvedAssemblyInPiTui({
      assembly,
      config: { baseDir: "E:/repo" },
      prompt: "hello",
    });

    expect(codingAgentMocks.createAgentSessionRuntime).toHaveBeenCalled();
    expect(codingAgentMocks.InteractiveMode).toHaveBeenCalledWith(expect.anything(), { initialMessage: "hello" });
    expect(runMock).toHaveBeenCalled();
  });

  it("未显式提供 prompt 时不注入启动消息", async () => {
    codingAgentMocks.createAgentSessionServices.mockResolvedValue({
      cwd: "E:/repo",
      agentDir: "E:/repo",
      diagnostics: [],
      modelRegistry: { find: vi.fn() },
    });
    codingAgentMocks.createAgentSessionFromServices.mockResolvedValue({
      session: {},
      extensionsResult: { extensions: [], errors: [], runtime: {} },
    });
    codingAgentMocks.SessionManager.inMemory.mockReturnValue({});
    codingAgentMocks.createAgentSessionRuntime.mockImplementation(async (factory: any, options: any) => {
      const created = await factory(options);
      return {
        diagnostics: created.diagnostics,
        session: created.session,
        dispose: vi.fn(),
      };
    });
    const runMock = vi.fn().mockResolvedValue(undefined);
    codingAgentMocks.InteractiveMode.mockImplementation(function (_runtimeHost: unknown, _options: unknown) {
      return { run: runMock };
    });

    const { runResolvedAssemblyInPiTui } = await import("../../../src/adapters/pi/pi-tui-agent-runner.js");
    const assembly: ResolvedPiAgentAssembly = {
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
    };

    await runResolvedAssemblyInPiTui({
      assembly,
      config: { baseDir: "E:/repo" },
    });

    expect(codingAgentMocks.InteractiveMode).toHaveBeenCalledWith(expect.anything(), { initialMessage: undefined });
    expect(runMock).toHaveBeenCalled();
  });
});
