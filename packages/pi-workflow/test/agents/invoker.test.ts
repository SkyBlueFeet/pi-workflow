import { describe, expect, it, beforeEach } from "vitest";
import { AgentRegistry, CustomAgentInvoker } from "../../src/agents/index.js";
import type { CustomAgentInvokeResult } from "../../src/agents/types.js";
import type { WorkflowPiHostCapabilities, WorkflowHostEvent, WorkflowAgentResult, WorkflowAgentRequest } from "../../src/adapters/pi/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

class MockHost implements WorkflowPiHostCapabilities {
  responses = new Map<string, string>();
  runAgentCalled = false;
  lastRequest?: WorkflowAgentRequest;

  setResponse(agentId: string, response: string): void {
    this.responses.set(agentId, response);
  }

  async *runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    this.runAgentCalled = true;
    this.lastRequest = request;
    const response = this.responses.get(request.nodeId.replace("custom-agent-", "")) ?? "default";
    yield { type: "agent.text_delta", delta: response };
    return { output: response, content: response };
  }
}

describe("CustomAgentInvoker", () => {
  let registry: AgentRegistry;
  let host: MockHost;
  let invoker: CustomAgentInvoker;
  const config: WorkflowConfig = {
    model: { provider: "openai", model: "gpt-4o-mini" },
    agents: {
      writer: {
        name: "Writer",
        systemPrompt: "You are a writer.",
        temperature: 0.4,
        maxTokens: 4096,
        skills: [{ name: "outline", source: "@pi/writing" }],
        mcp: [{ server: "ctx7" }],
      },
      reader: {
        name: "Reader",
        systemPrompt: "You are a reader.",
      },
    },
  };

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.loadFromConfig(config);
    host = new MockHost();
    host.setResponse("writer", "Written content");
    host.setResponse("reader", "Read content");
    invoker = new CustomAgentInvoker({ host, registry, config });
  });

  it("调用存在的智能体并返回内容", async () => {
    const gen = invoker.invoke({ agentId: "writer", prompt: "Write something" });
    let content = "";
    for await (const event of gen) {
      if (event.type === "agent.text_delta") content += event.delta;
    }
    expect(content).toBe("Written content");
  });

  it("不存在的智能体返回 agent.error", async () => {
    const gen = invoker.invoke({ agentId: "nonexistent", prompt: "test" });
    let errorEvent: WorkflowHostEvent | undefined;
    for await (const event of gen) {
      if (event.type === "agent.error") errorEvent = event;
    }
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "agent.error") {
      expect(errorEvent.error).toContain("未找到");
    }
  });

  it("总是通过 runAgent 携带完整定义语义", async () => {
    const gen = invoker.invoke({ agentId: "writer", prompt: "test" });
    for await (const _ of gen) { /* consume */ }
    expect(host.runAgentCalled).toBe(true);
    expect(host.lastRequest?.systemPrompt).toBe("You are a writer.");
    expect(host.lastRequest?.temperature).toBe(0.4);
    expect(host.lastRequest?.maxTokens).toBe(4096);
    expect(host.lastRequest?.skills).toHaveLength(1);
    expect(host.lastRequest?.skills?.[0].name).toBe("outline");
    expect(host.lastRequest?.mcp).toHaveLength(1);
    expect(host.lastRequest?.mcp?.[0].server).toBe("ctx7");
  });

  it("多个智能体各自独立运行", async () => {
    const gen1 = invoker.invoke({ agentId: "writer", prompt: "Write" });
    let c1 = "";
    for await (const event of gen1) {
      if (event.type === "agent.text_delta") c1 += event.delta;
    }
    expect(c1).toBe("Written content");

    const gen2 = invoker.invoke({ agentId: "reader", prompt: "Read" });
    let c2 = "";
    for await (const event of gen2) {
      if (event.type === "agent.text_delta") c2 += event.delta;
    }
    expect(c2).toBe("Read content");
  });

  it("不指定 prompt 时使用 input 序列化作为兜底", async () => {
    const gen = invoker.invoke({ agentId: "writer", input: { key: "value" } });
    for await (const _ of gen) { /* consume */ }
    expect(host.lastRequest?.prompt).toBe('{"key":"value"}');
  });

  it("宿主无任何事件时返回不带轮次的错误提示", async () => {
    host.runAgent = async function* () {
      return { output: null, content: "" };
    };

    const gen = invoker.invoke({
      agentId: "writer",
      prompt: "Write something",
      initialMessages: [{ role: "user", content: "hi" }],
    });
    const events: WorkflowHostEvent[] = [];
    for await (const event of gen) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: "agent.error",
      error: "模型未返回任何输出，请检查 API Key、网络或模型响应",
    });
  });
});
