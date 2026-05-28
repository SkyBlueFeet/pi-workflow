import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

describe("WorkflowRuntime - unsupported", () => {
  it("未注册 executor 的节点类型输出 workflow.failed 事件", async () => {
    const registry = new ExecutorRegistry();
    registry.register("return", new ReturnExecutor());

    const dsl = {
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [
        { id: "a", title: "Agent", executor: { type: "agent" } },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = new WorkflowRuntime({ executorRegistry: registry });
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.failed");
  });
});
