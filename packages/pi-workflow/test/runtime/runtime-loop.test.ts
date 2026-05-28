import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("loop", new (class { async execute(node: any, ctx: any) { return { output: {}, artifacts: [] }; } })());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - loop composite node", () => {
  it("对每个 item 执行子节点", async () => {
    const dsl = {
      id: "loop-test", version: "1", title: "Loop Test", entry: "iterate",
      nodes: [
        {
          id: "iterate", title: "Iterate", executor: { type: "loop" },
          children: ["process"],
          control: {
            loopOver: { from: "literal", value: ["a", "b", "c"] },
            itemName: "item",
          },
        },
        {
          id: "process", title: "Process", executor: { type: "manual" },
          inputs: { current: { from: "frame.local", path: "item" } },
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

    expect(events.filter(e => e === "node.started").length).toBe(4);
    expect(events.filter(e => e === "node.completed").length).toBe(4);
    expect(events).toContain("workflow.completed");
  });

  it("多次迭代各自独立更新 sharedContext", async () => {
    const dsl = {
      id: "loop-ctx", version: "1", title: "Loop Ctx Test", entry: "iterate",
      nodes: [
        {
          id: "iterate", title: "Iterate", executor: { type: "loop" },
          children: ["collect"],
          control: {
            loopOver: { from: "literal", value: [1, 2, 3] },
            itemName: "item",
          },
        },
        {
          id: "collect", title: "Collect", executor: { type: "manual" },
          inputs: { val: { from: "frame.local", path: "item" } },
          output: { to: "items", mergeStrategy: "append-array" },
        },
        {
          id: "report", title: "Report", executor: { type: "return" },
          dependsOn: ["iterate"],
          output: { to: "final", mergeStrategy: "replace" },
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    let finalOutput: unknown;

    for await (const event of runtime.run({ ir })) {
      if (event.type === "workflow.completed") finalOutput = event.finalOutput;
    }

    const items = (finalOutput as any)?.items as unknown[];
    expect(items).toBeDefined();
    expect(items).toHaveLength(3);
  });
});
