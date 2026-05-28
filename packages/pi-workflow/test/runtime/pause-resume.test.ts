import { describe, it, expect } from "vitest";
import { dslToIr, loadFromObject, WorkflowRuntime, ExecutorRegistry, MemoryWorkflowRunStore } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor, AwaitInputError } from "../../src/index.js";

describe("WorkflowRuntime - pause/resume", () => {
  it("workflow 在需要输入时暂停", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor(
      input => input,
      input => true,
    ));
    registry.register("return", new ReturnExecutor());
    const store = new MemoryWorkflowRunStore();
    const runtime = new WorkflowRuntime({ executorRegistry: registry, store });

    const dsl = {
      id: "pause-test", version: "1", title: "Pause Test", entry: "step",
      nodes: [
        { id: "step", title: "Needs Input", executor: { type: "manual" } },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);

    let paused = false;
    let runId = "";
    for await (const event of runtime.run({ ir })) {
      if (event.type === "workflow.paused") {
        paused = true;
        runId = event.workflowRunId;
      }
    }

    expect(paused).toBe(true);
    expect(runId).toBeTruthy();
  });

  it("暂停后 resume 可恢复执行", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor(
      input => input,
      input => !input["_skip"],
    ));
    registry.register("return", new ReturnExecutor());
    const store = new MemoryWorkflowRunStore();
    const runtime = new WorkflowRuntime({ executorRegistry: registry, store });

    const dsl = {
      id: "resume-test", version: "1", title: "Resume Test", entry: "step",
      nodes: [
        {
          id: "step", title: "Needs Input", executor: { type: "manual" },
          output: { to: "result", mergeStrategy: "replace" },
        },
        {
          id: "done", title: "Done", executor: { type: "return" }, dependsOn: ["step"],
          output: { to: "final", mergeStrategy: "replace" },
        },
      ],
    };

    const { document } = loadFromObject(dsl);
    const ir = dslToIr(document);

    let runId = "";
    for await (const event of runtime.run({ ir })) {
      if (event.type === "workflow.paused") {
        runId = event.workflowRunId;
      }
    }

    expect(runId).toBeTruthy();

    const state = await store.loadRunState(runId);
    expect(state).toBeDefined();

    const runtime2 = new WorkflowRuntime({ executorRegistry: registry, store });
    let completed = false;
    let finalOutput: unknown;
    for await (const event of runtime2.resume({ state: state!, interactionInput: { _skip: true } })) {
      if (event.type === "workflow.completed") {
        completed = true;
        finalOutput = event.finalOutput;
      }
    }

    expect(completed).toBe(true);
    expect(finalOutput).toBeDefined();
  });
});
