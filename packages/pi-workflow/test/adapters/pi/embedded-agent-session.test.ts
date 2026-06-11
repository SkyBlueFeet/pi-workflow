import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  createPiAgentSessionRuntime: vi.fn(),
}));

vi.mock("../../../src/adapters/pi/pi-agent-session-runtime.js", () => ({
  createPiAgentSessionRuntime: runtimeMocks.createPiAgentSessionRuntime,
}));

describe("createEmbeddedAgentSessionController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("将 session 事件映射为嵌入式 agent 事件", async () => {
    const listeners: Array<(event: unknown) => void> = [];
    runtimeMocks.createPiAgentSessionRuntime.mockResolvedValue({
      runtimeHost: {
        session: {
          sessionId: "session-1",
          bindExtensions: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn((listener: (event: unknown) => void) => {
            listeners.push(listener);
            return () => {};
          }),
          prompt: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
        },
        dispose: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { createEmbeddedAgentSessionController } = await import("../../../src/adapters/pi/embedded-agent-session.js");
    const controller = await createEmbeddedAgentSessionController({
      nodeId: "agent-1",
      assembly: {
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
      },
    });

    const received: unknown[] = [];
    controller.subscribe((event) => {
      received.push(event);
    });

    listeners[0]!({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        delta: "hello",
      },
    });
    listeners[0]!({
      type: "tool_execution_start",
      toolName: "search",
    });
    listeners[0]!({
      type: "tool_execution_end",
      toolName: "search",
    });

    expect(received).toEqual([
      { type: "agent.message", nodeId: "agent-1", role: "assistant", text: "hello" },
      { type: "agent.state", nodeId: "agent-1", state: "streaming" },
      { type: "agent.tool", nodeId: "agent-1", toolName: "search", status: "start" },
      { type: "agent.tool", nodeId: "agent-1", toolName: "search", status: "end" },
    ]);
  });
});
