import { describe, expect, it } from "vitest";
import { dslToIr, ExecutorRegistry, loadFromObject, ManualExecutor, ReturnExecutor, WorkflowRuntime } from "../../src/index.js";

describe("WorkflowRuntime - security failure", () => {
  it("高风险节点被安全策略拒绝后应触发 workflow.failed，且下游节点不得继续执行", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor((input) => input));
    registry.register("return", new ReturnExecutor());
    registry.register("http", new ManualExecutor((input) => input));

    const dsl = {
      id: "security-failure",
      version: "1.0",
      title: "Security Failure",
      entry: "http-node",
      nodes: [
        {
          id: "http-node",
          title: "HTTP",
          executor: { type: "http" },
          inputs: {
            url: { from: "literal", value: "https://example.test" },
          },
        },
        {
          id: "after-http",
          title: "After HTTP",
          executor: { type: "manual" },
          dependsOn: ["http-node"],
          inputs: {
            ok: { from: "literal", value: true },
          },
        },
        {
          id: "final",
          title: "Final",
          executor: { type: "return" },
          dependsOn: ["after-http"],
          output: { to: "final", mergeStrategy: "replace" },
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = new WorkflowRuntime({ executorRegistry: registry });
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("node.failed");
    expect(events).toContain("workflow.failed");
    expect(events).not.toContain("workflow.completed");
    expect(events).not.toContain("node.completed");
  });
});
