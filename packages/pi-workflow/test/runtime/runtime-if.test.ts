import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("if", new (class { async execute(node: any, ctx: any) { return { output: {}, artifacts: [] }; } })());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - if composite node", () => {
  it("条件为 true 时执行子节点", async () => {
    const dsl = {
      id: "if-test", version: "1", title: "If Test", entry: "decide",
      nodes: [
        {
          id: "decide", title: "Check", executor: { type: "if" },
          children: ["then-step"],
          control: { condition: { from: "literal", value: true } },
        },
        {
          id: "then-step", title: "Then", executor: { type: "return" },
          inputs: { msg: { from: "literal", value: "executed" } },
          dependsOn: ["decide"],
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("node.completed");
    expect(events.filter(e => e === "node.completed").length).toBe(2);
  });

  it("条件为 false 时跳过子节点", async () => {
    const dsl = {
      id: "if-false", version: "1", title: "If False Test", entry: "decide",
      nodes: [
        {
          id: "decide", title: "Skip", executor: { type: "if" },
          children: ["then-step"],
          control: { condition: { from: "literal", value: false } },
        },
        {
          id: "then-step", title: "Then", executor: { type: "return" },
          inputs: { msg: { from: "literal", value: "should-not-run" } },
          dependsOn: ["decide"],
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events.filter(e => e === "node.started").length).toBe(1);
    expect(events.filter(e => e === "node.completed").length).toBe(1);
  });
});
