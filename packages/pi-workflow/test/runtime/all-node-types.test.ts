import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentExecutor,
  dslToIr,
  ExecutorRegistry,
  ExtractorExecutor,
  HttpExecutor,
  loadFromObject,
  ManualExecutor,
  MockPiHostAdapter,
  ReturnExecutor,
  ToolExecutor,
  WorkflowRuntime,
} from "../../src/index.js";
import type { WorkflowAgentRequest, WorkflowAgentResult, WorkflowConfig, WorkflowHostEvent } from "../../src/index.js";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/dsl/all-node-types.workflow.json",
);

class RecordingPiHostAdapter extends MockPiHostAdapter {
  readonly agentRequests: WorkflowAgentRequest[] = [];

  override async *runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    this.agentRequests.push(request);
    return yield* super.runAgent(request);
  }
}

function loadFixture() {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const { document, diagnostics } = loadFromObject(parsed);

  expect(diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);

  return dslToIr(document);
}

function createRuntime(host: MockPiHostAdapter) {
  const registry = new ExecutorRegistry();
  const toolExecutor = new ToolExecutor();

  toolExecutor.register("echo", async params => ({
    content: JSON.stringify(params),
    isError: false,
    details: params,
  }));

  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("http", new HttpExecutor());
  registry.register("extractor", new ExtractorExecutor());
  registry.register("tool", toolExecutor);
  registry.register("agent", new AgentExecutor());

  return new WorkflowRuntime({ executorRegistry: registry, host });
}

function createConfig(): WorkflowConfig {
  return {
    model: {
      provider: "mock",
      model: "test-model",
    },
    agents: {
      "all-node-types-agent": {
        systemPrompt: "你是一个测试用数据分析助手。",
        model: {
          provider: "mock",
          model: "agent-model",
        },
        temperature: 0.1,
        skills: [],
        tools: [],
        mcp: [],
        permissions: [{ capability: "extension.execute" }],
      },
    },
    security: {
      permissions: [
        { capability: "network.request" },
        { capability: "process.execute" },
        { capability: "extension.execute" },
      ],
    },
  };
}

describe("all-node-types fixture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("全部节点类型都能完成一次离线运行", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      source: "mock-fetch",
    }), {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const host = new RecordingPiHostAdapter();
    host.setResponse("custom-agent-all-node-types-agent", "mock agent ok");

    const runtime = createRuntime(host);
    const events = [];

    for await (const event of runtime.run({ ir: loadFixture(), config: createConfig() })) {
      events.push(event);
    }

    const failedEvents = events.filter(event => event.type === "node.failed" || event.type === "workflow.failed");
    expect(failedEvents).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(host.agentRequests).toHaveLength(1);
    expect(host.agentRequests[0]?.skills ?? []).toEqual([]);
    expect(host.agentRequests[0]?.tools ?? []).toEqual([]);
    expect(host.agentRequests[0]?.mcp ?? []).toEqual([]);
    expect(host.agentRequests[0]?.toolExecutors).toBeUndefined();

    const completedNodeIds = events
      .filter(event => event.type === "node.completed")
      .map(event => event.nodeId);

    expect(completedNodeIds).toEqual(expect.arrayContaining([
      "init",
      "decide",
      "branch-body",
      "fan-out",
      "task-http",
      "task-extract",
      "call-tool",
      "ai-agent",
      "iterate",
      "loop-body",
      "sub",
      "sub-step",
      "final",
    ]));
    expect(completedNodeIds.filter(nodeId => nodeId === "loop-body")).toHaveLength(3);

    const completed = events.find(event => event.type === "workflow.completed");
    expect(completed?.type).toBe("workflow.completed");
    if (completed?.type !== "workflow.completed") return;

    const finalOutput = completed.finalOutput as Record<string, Record<string, unknown>>;
    expect(finalOutput.httpResult.status).toBe(200);
    expect(finalOutput.extractResult.data).toEqual({ name: "Alice", age: "30" });
    expect(finalOutput.toolResult).toEqual({
      content: "{\"message\":\"hello from tool node\",\"source\":\"all-node-types\"}",
      isError: false,
      details: {
        message: "hello from tool node",
        source: "all-node-types",
      },
    });
    expect(finalOutput.agentResult).toBe("mock agent ok");
    expect(finalOutput.loopResult).toEqual([{ current: "x" }, { current: "y" }, { current: "z" }]);
    expect(finalOutput.final).toMatchObject({
      httpStatus: 200,
      agent: "mock agent ok",
      sub: { summary: "子工作流完成" },
    });
  });
});
