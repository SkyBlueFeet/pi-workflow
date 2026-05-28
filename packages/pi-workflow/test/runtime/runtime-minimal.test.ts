import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";
import { ToolExecutor } from "../../src/executors/tool-executor.js";

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("WorkflowRuntime - minimal", () => {
  it("执行最小 return 工作流", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", title: "Done", executor: { type: "return" }, inputs: { v: { from: "literal", value: "ok" } } },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.started");
    expect(events).toContain("node.started");
    expect(events).toContain("node.completed");
    expect(events).toContain("workflow.completed");
  });

  it("return 节点输出合并到 shared context", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        {
          id: "root", title: "Done", executor: { type: "return" },
          inputs: { v: { from: "literal", value: "hello" } },
          output: { to: "result", mergeStrategy: "replace" },
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

    expect(finalOutput).toEqual({ result: { v: "hello" } });
  });

  it("运行事件包含时间戳、节点输入和输出快照", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", title: "Done", executor: { type: "return" }, inputs: { v: { from: "literal", value: "ok" } } },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event);
    }

    const completed = events.find(event => event.type === "node.completed");
    expect(events.every(event => typeof event.timestamp === "string")).toBe(true);
    expect(completed?.type).toBe("node.completed");
    if (completed?.type === "node.completed") {
      expect(completed.input).toEqual({ v: "ok" });
      expect(completed.output).toEqual({ v: "ok" });
      expect(completed.contextSnapshot).toEqual({});
    }
  });

  it("权限不足但用户授权一次后继续执行节点", async () => {
    const dsl = {
      id: "test", version: "1", title: "Test", entry: "tool1",
      nodes: [
        {
          id: "tool1",
          title: "Tool",
          executor: { type: "tool" },
          inputs: {
            toolName: { from: "literal", value: "echo" },
            params: { from: "literal", value: { value: "ok" } },
          },
          output: { to: "result", mergeStrategy: "replace" },
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);
    const registry = new ExecutorRegistry();
    const toolExecutor = new ToolExecutor();
    toolExecutor.register("echo", async (params) => params);
    registry.register("tool", toolExecutor);
    registry.register("manual", new ManualExecutor(input => input));
    registry.register("return", new ReturnExecutor());

    const runtime = new WorkflowRuntime({
      executorRegistry: registry,
      host: {
        requestUserInput: async () => ({ input: { approved: true } }),
      },
    });

    let finalOutput: unknown;
    for await (const event of runtime.run({
      ir,
      config: {},
    })) {
      if (event.type === "workflow.completed") {
        finalOutput = event.finalOutput;
      }
    }

    expect(finalOutput).toEqual({ result: { value: "ok" } });
  });
});
