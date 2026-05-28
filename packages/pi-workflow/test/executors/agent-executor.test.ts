import { describe, it, expect } from "vitest";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";
import type { WorkflowPiHostCapabilities, WorkflowHostEvent, WorkflowAgentResult, WorkflowAgentRequest } from "../../src/adapters/pi/types.js";
import { AgentExecutor } from "../../src/executors/agent-executor.js";
import type { WorkflowRuntime } from "../../src/runtime/workflow-runtime.js";

function createMockPiHost(
  response: string,
  onRequest?: (req: WorkflowAgentRequest) => void,
  permissionCheck?: WorkflowPiHostCapabilities["checkPermission"],
): WorkflowPiHostCapabilities {
  return {
    checkPermission: permissionCheck,
    async *runAgent(request): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
      onRequest?.(request);
      yield { type: "agent.text_delta", delta: response };
      return { output: response, content: response };
    },
  };
}

describe("AgentExecutor", () => {
  it("使用 PI host 执行 agent 节点并返回产物", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "agent1", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      output: { to: "result", mergeStrategy: "replace" },
    };
    const context: ExecutionContext = {
      runId: "test-run",
      nodeId: "agent1",
      nodeInput: { user_prompt: "Say hello" },
      sharedContext: {},
      host: createMockPiHost("Hello World"),
    };

    const result = await executor.execute(node, context);
    expect(result.output).toBe("Hello World");
  });

  it("透传 system_prompt 和 user_prompt 到 host", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a1", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
    };
    let capturedRequest: WorkflowAgentRequest | undefined;

    const context: ExecutionContext = {
      runId: "test", nodeId: "a1",
      nodeInput: {
        system_prompt: "You are a poet.",
        user_prompt: "Write a haiku",
      },
      sharedContext: {},
      host: createMockPiHost("haiku", req => { capturedRequest = req; }),
    };

    await executor.execute(node, context);
    expect(capturedRequest!.systemPrompt).toBe("You are a poet.");
    expect(capturedRequest!.prompt).toBe("Write a haiku");
  });

  it("透传 skills/tools/mcp 配置到 host", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a2", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      capabilities: {
        skills: [{ name: "analyze", source: "@pi/tools" }],
        tools: [{ name: "search", description: "Search" }],
        mcp: [{ server: "npx mcp-server", args: ["--port", "8080"] }],
      },
    };
    let capturedRequest: WorkflowAgentRequest | undefined;

    const context: ExecutionContext = {
      runId: "test", nodeId: "a2",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok", req => { capturedRequest = req; }),
    };

    await executor.execute(node, context);
    expect(capturedRequest!.skills).toHaveLength(1);
    expect(capturedRequest!.skills![0].name).toBe("analyze");
    expect(capturedRequest!.tools).toHaveLength(1);
    expect(capturedRequest!.tools![0].name).toBe("search");
    expect(capturedRequest!.mcp).toHaveLength(1);
    expect(capturedRequest!.mcp![0].server).toContain("mcp-server");
  });

  it("没有 PI host 时抛出错误", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "bad", title: "Bad", kind: "agent",
      dependsOn: [], inputBindings: {},
    };
    const context: ExecutionContext = {
      runId: "test", nodeId: "bad", nodeInput: {},
      sharedContext: {}, host: {},
    };

    await expect(executor.execute(node, context)).rejects.toThrow("PI host");
  });

  it("兼容旧版 prompt 字段", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a3", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
    };
    let capturedRequest: WorkflowAgentRequest | undefined;

    const context: ExecutionContext = {
      runId: "test", nodeId: "a3",
      nodeInput: { prompt: "legacy prompt" },
      sharedContext: {},
      host: createMockPiHost("ok", req => { capturedRequest = req; }),
    };

    await executor.execute(node, context);
    expect(capturedRequest!.prompt).toBe("legacy prompt");
  });

  it("将 workflow tool 执行器透传给 host", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a4", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };
    let capturedRequest: WorkflowAgentRequest | undefined;

    const context: ExecutionContext = {
      runId: "test", nodeId: "a4",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok", req => { capturedRequest = req; }),
      runtime: {} as WorkflowRuntime,
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }, { capability: "workflow.invoke" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "extension.execute" }, { capability: "workflow.invoke" }],
            workflowTools: {
              summarize: {
                workflow: {
                  id: "wf1",
                  version: "1",
                  title: "wf1",
                  entryNodeIds: [],
                  nodes: [],
                  edges: [],
                },
              },
            },
          },
        },
      },
    };

    await executor.execute(node, context);
    expect(capturedRequest?.toolExecutors).toHaveLength(1);
    expect(capturedRequest?.toolExecutors?.[0].name).toBe("summarize");
  });

  it("透传 agent 定义中的模型、skills、mcp 和采样参数", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a5", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };
    let capturedRequest: WorkflowAgentRequest | undefined;

    const context: ExecutionContext = {
      runId: "test", nodeId: "a5",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok", req => { capturedRequest = req; }),
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }, { capability: "mcp.use" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "extension.execute" }, { capability: "mcp.use" }],
            model: { provider: "anthropic", model: "claude-3-7-sonnet", temperature: 0.2, maxTokens: 2048 },
            temperature: 0.4,
            maxTokens: 4096,
            skills: [{ name: "outline" }],
            mcp: [{ server: "ctx7" }],
          },
        },
      },
    };

    await executor.execute(node, context);
    expect(capturedRequest?.model).toBe("anthropic/claude-3-7-sonnet");
    expect(capturedRequest?.temperature).toBe(0.4);
    expect(capturedRequest?.maxTokens).toBe(4096);
    expect(capturedRequest?.skills?.map(skill => skill.name)).toEqual(["outline"]);
    expect(capturedRequest?.mcp?.map(entry => entry.server)).toEqual(["ctx7"]);
  });

  it("agent 权限缺少 extension.execute 时拒绝执行", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a6", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };

    const context: ExecutionContext = {
      runId: "test", nodeId: "a6",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok"),
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "workflow.invoke" }],
          },
        },
      },
    };

    await expect(executor.execute(node, context)).rejects.toThrow("未获授权");
  });

  it("agent 使用 MCP 但未授权 mcp.use 时拒绝执行", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a7", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };

    const context: ExecutionContext = {
      runId: "test", nodeId: "a7",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok"),
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }, { capability: "mcp.use" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "extension.execute" }],
            mcp: [{ server: "ctx7" }],
          },
        },
      },
    };

    await expect(executor.execute(node, context)).rejects.toThrow("MCP \"ctx7\" 未获授权");
  });

  it("PI 侧拒绝 extension.execute 时阻止 agent 执行", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a8", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };

    const context: ExecutionContext = {
      runId: "test", nodeId: "a8",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: createMockPiHost("ok", undefined, async () => ({ allowed: false, reason: "pi deny" })),
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "extension.execute" }],
          },
        },
      },
    };

    await expect(executor.execute(node, context)).rejects.toThrow('[PI] pi deny');
  });

  it("权限不足但用户批准一次时继续执行 agent", async () => {
    const executor = new AgentExecutor();
    const node: WorkflowNodeIR = {
      id: "a9", title: "Agent", kind: "agent",
      dependsOn: [], inputBindings: {},
      executor: { type: "agent", config: { agentId: "writer" } },
    };

    const context: ExecutionContext = {
      runId: "test", nodeId: "a9",
      nodeInput: { user_prompt: "test" },
      sharedContext: {},
      host: {
        ...createMockPiHost("ok"),
        requestUserInput: async () => ({ input: { approved: true } }),
      },
      config: {
        model: { provider: "openai", model: "gpt-4o-mini" },
        security: {
          permissions: [{ capability: "extension.execute" }],
        },
        agents: {
          writer: {
            permissions: [{ capability: "workflow.invoke" }],
          },
        },
      },
    };

    await expect(executor.execute(node, context)).resolves.toMatchObject({ output: "ok" });
  });
});
