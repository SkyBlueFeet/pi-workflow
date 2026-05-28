import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - subworkflow", () => {
  it("执行含子节点的 workflow 节点", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", title: "Root", executor: { type: "workflow" }, children: ["collect", "review"] },
        { id: "collect", title: "Collect", executor: { type: "manual" }, inputs: { v: { from: "literal", value: "data" } } },
        { id: "review", title: "Review", executor: { type: "manual" }, inputs: { v: { from: "literal", value: "ok" } }, dependsOn: ["collect"] },
        { id: "finalize", title: "Done", executor: { type: "return" }, dependsOn: ["review"] },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events.filter(e => e === "node.completed").length).toBe(4);
    expect(events).toContain("workflow.completed");
  });

  it("frame id 区分父子节点", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", title: "Root", executor: { type: "workflow" }, children: ["step1"] },
        { id: "step1", title: "Step 1", executor: { type: "manual" }, inputs: { v: { from: "literal", value: 1 } } },
        { id: "done", title: "Done", executor: { type: "return" }, dependsOn: ["root"] },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const frames: string[] = [];

    for await (const event of runtime.run({ ir })) {
      if (event.type === "frame.entered") frames.push(event.frameId);
      if (event.type === "frame.completed") frames.push(event.frameId);
    }

    expect(frames.some(f => f.includes("/root"))).toBe(true);
    expect(frames.some(f => f.includes("/children/root"))).toBe(true);
  });
});
