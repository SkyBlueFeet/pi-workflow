import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - retry/timeout integration", () => {
  it("retry 策略使失败的节点最终成功", async () => {
    let attempts = 0;
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor((input) => {
      attempts++;
      if (attempts < 3) throw new Error(`attempt-${attempts}`);
      return input;
    }));
    registry.register("return", new ReturnExecutor());
    const runtime = new WorkflowRuntime({ executorRegistry: registry });

    const dsl = {
      id: "retry-test", version: "1", title: "Retry Test", entry: "a",
      nodes: [
        {
          id: "a", title: "RetryNode", executor: { type: "manual" },
          inputs: { v: { from: "literal", value: "ok" } },
          control: {
            retry: { maxAttempts: 5, delayMs: 5 },
          },
        },
        {
          id: "done", title: "Done", executor: { type: "return" },
          dependsOn: ["a"],
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(attempts).toBe(3);
    expect(events).toContain("workflow.completed");
  });

  it("timeout 超时导致 workflow.failed", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor(async () => {
      await new Promise(r => setTimeout(r, 500));
      return {};
    }));
    registry.register("return", new ReturnExecutor());
    const runtime = new WorkflowRuntime({ executorRegistry: registry });

    const dsl = {
      id: "timeout-test", version: "1", title: "Timeout Test", entry: "a",
      nodes: [
        {
          id: "a", title: "SlowNode", executor: { type: "manual" },
          inputs: { v: { from: "literal", value: "slow" } },
          control: {
            timeoutMs: 10,
          },
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.failed");
  });
});
