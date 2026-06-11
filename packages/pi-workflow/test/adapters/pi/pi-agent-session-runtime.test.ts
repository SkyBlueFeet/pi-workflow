import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPiAgentAssembly } from "../../../src/agents/types.js";

const codingAgentMocks = vi.hoisted(() => ({
  createAgentSessionServices: vi.fn(),
  createAgentSessionFromServices: vi.fn(),
  createAgentSessionRuntime: vi.fn(),
  SessionManager: {
    inMemory: vi.fn(),
  },
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices: codingAgentMocks.createAgentSessionServices,
  createAgentSessionFromServices: codingAgentMocks.createAgentSessionFromServices,
  createAgentSessionRuntime: codingAgentMocks.createAgentSessionRuntime,
  SessionManager: codingAgentMocks.SessionManager,
}));

describe("createPiAgentSessionRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("创建可复用的 session runtime 并返回 services", async () => {
    codingAgentMocks.createAgentSessionServices.mockResolvedValue({
      cwd: "E:/repo",
      agentDir: "E:/repo",
      diagnostics: [],
      modelRegistry: { find: vi.fn() },
    });
    codingAgentMocks.createAgentSessionFromServices.mockResolvedValue({
      session: { sessionId: "session-1" },
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

    const { createPiAgentSessionRuntime } = await import("../../../src/adapters/pi/pi-agent-session-runtime.js");
    const assembly: ResolvedPiAgentAssembly = {
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
    };

    const result = await createPiAgentSessionRuntime({
      assembly,
      config: { baseDir: "E:/repo" },
    });

    expect(codingAgentMocks.createAgentSessionRuntime).toHaveBeenCalled();
    expect(result.runtimeHost.session).toEqual({ sessionId: "session-1" });
    expect(result.services.cwd).toBe("E:/repo");
  });
});
