import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentExecutor,
  AssignExecutor,
  CodeExecutor,
  DelayExecutor,
  dslToIr,
  ExecutorRegistry,
  ExtractorExecutor,
  HttpExecutor,
  ListOpExecutor,
  loadFromObject,
  ManualExecutor,
  MergeExecutor,
  MockPiHostAdapter,
  ReturnExecutor,
  TemplateExecutor,
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
  registry.register("template", new TemplateExecutor());
  registry.register("assign", new AssignExecutor());
  registry.register("merge", new MergeExecutor());
  registry.register("code", new CodeExecutor());
  registry.register("delay", new DelayExecutor());
  registry.register("list-op", new ListOpExecutor());

  return new WorkflowRuntime({ executorRegistry: registry, host });
}

function createConfig(): WorkflowConfig {
  return {
    model: {
      provider: "mock",
      model: "test-model",
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

  it("全部节点类型都能完成一次有业务意义的离线履约处置流程", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: "amber",
      dispatchWindow: "18:00",
      lane: "east-region",
    }), {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const host = new RecordingPiHostAdapter();
    host.setResponse("agent-summary", "建议优先从 North Hub 调拨，并同步升级给运营经理复核承运窗口。");

    const runtime = createRuntime(host);
    const events = [];

    for await (const event of runtime.run({ ir: loadFixture(), config: createConfig() })) {
      events.push(event);
    }

    const failedEvents = events.filter(event => event.type === "node.failed" || event.type === "workflow.failed");
    expect(failedEvents).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(host.agentRequests).toHaveLength(1);
    expect(host.agentRequests[0]?.skills).toBeUndefined();
    expect(host.agentRequests[0]?.tools).toBeUndefined();
    expect(host.agentRequests[0]?.mcp).toBeUndefined();
    expect(host.agentRequests[0]?.toolExecutors).toBeUndefined();

    const completedNodeIds = events
      .filter(event => event.type === "node.completed")
      .map(event => event.nodeId);

    expect(completedNodeIds).toEqual(expect.arrayContaining([
      "init",
      "extract-order",
      "task-http",
      "carrier-fallback",
      "merge-carrier",
      "screen-candidates",
      "sort-candidates",
      "select-plan",
      "decide-escalation",
      "fallback-escalation",
      "merge-escalation",
      "call-tool",
      "draft-message",
      "agent-summary",
      "pause-for-sync",
      "build-actions",
      "iterate",
      "loop-body",
      "assign-report",
      "sub",
      "sub-step",      
      "final",
    ]));
    expect(completedNodeIds.filter(nodeId => nodeId === "loop-body")).toHaveLength(3);

    const completed = events.find(event => event.type === "workflow.completed");
    expect(completed?.type).toBe("workflow.completed");
    if (completed?.type !== "workflow.completed") return;

    const finalOutput = completed.finalOutput as Record<string, any>;
    expect(finalOutput.carrierDecision).toMatchObject({
      status: "amber",
      dispatchWindow: "18:00",
      lane: "east-region",
    });
    expect(finalOutput.orderInfo.data).toEqual({
      warehouse: "East Hub",
      sku: "SKU-42",
      shortage: "18",
      priority: "high",
      customer: "Aurora Market",
    });
    expect(finalOutput.dispatchPlan).toMatchObject({
      ticketId: "RST-20260611-001",
      recommendedWarehouse: "North Hub",
      transferableUnits: 18,
      carrierWindow: "18:00",
      escalationNeeded: true,
      riskLevel: "attention",
    });
    expect(finalOutput.notificationPayload).toEqual({
      content: JSON.stringify(finalOutput.dispatchPlan),
      isError: false,
      details: finalOutput.dispatchPlan,
    });
    expect(finalOutput.customerMessage).toContain("North Hub");
    expect(finalOutput.customerMessage).toContain("SKU-42");
    expect(finalOutput.agentSummary).toBe("建议优先从 North Hub 调拨，并同步升级给运营经理复核承运窗口。");
    expect(finalOutput.actionItems).toEqual([
      { step: "从North Hub锁定18件SKU-42" },
      { step: "在18:00前提交承运预约" },
      { step: "升级给ops-manager复核：承运窗口受限或无法当日达，需要人工确认是否拆单" },
    ]);
    expect(finalOutput.report).toMatchObject({
      plan: expect.objectContaining({
        recommendedWarehouse: "North Hub",
      }),
      customerMessage: finalOutput.customerMessage,
      agentSummary: "建议优先从 North Hub 调拨，并同步升级给运营经理复核承运窗口。",
    });
    expect(finalOutput.final).toMatchObject({
      ticketId: "RST-20260611-001",
      escalation: {
        level: "ops-manager",
        reason: "承运窗口受限或无法当日达，需要人工确认是否拆单",
      },
      closure: {
        status: "ready-to-dispatch",
        owner: "supply-ops",
      },
    });
  });
});
