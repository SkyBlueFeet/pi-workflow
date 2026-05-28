import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("parallel", new (class { async execute(node: any, ctx: any) { return { output: {}, artifacts: [] }; } })());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - parallel composite node", () => {
  it("并行执行子节点并收集结果", async () => {
    const dsl = {
      id: "parallel-test", version: "1", title: "Parallel Test", entry: "fork",
      nodes: [
        {
          id: "fork", title: "Fork", executor: { type: "parallel" },
          children: ["branch-a", "branch-b"],
        },
        {
          id: "branch-a", title: "Branch A", executor: { type: "manual" },
          inputs: { v: { from: "literal", value: "A" } },
          output: { to: "branchA", mergeStrategy: "replace" },
        },
        {
          id: "branch-b", title: "Branch B", executor: { type: "manual" },
          inputs: { v: { from: "literal", value: "B" } },
          output: { to: "branchB", mergeStrategy: "replace" },
        },
        {
          id: "done", title: "Done", executor: { type: "return" },
          dependsOn: ["fork"],
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

    expect(finalOutput).toBeDefined();
  });

  it("分支抛出错误时 workflow.failed 并带错误信息", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor((input) => {
      if (input.throwError) throw new Error("branch-error");
      return input;
    }));
    registry.register("return", new ReturnExecutor());
    registry.register("parallel", new (class { async execute(node: any, ctx: any) { return { output: {}, artifacts: [] }; } })());
    const runtime = new WorkflowRuntime({ executorRegistry: registry });

    const dsl = {
      id: "parallel-error", version: "1", title: "Parallel Error", entry: "fork",
      nodes: [
        {
          id: "fork", title: "Fork", executor: { type: "parallel" },
          children: ["good-branch", "bad-branch"],
        },
        {
          id: "good-branch", title: "Good", executor: { type: "manual" },
          inputs: { v: { from: "literal", value: "ok" } },
        },
        {
          id: "bad-branch", title: "Bad", executor: { type: "manual" },
          inputs: { throwError: { from: "literal", value: true } },
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
    expect(events).toContain("node.failed");
  });
});
