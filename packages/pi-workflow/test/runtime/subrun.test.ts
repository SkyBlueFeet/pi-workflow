import { describe, expect, it, vi } from "vitest";
import { executeSubWorkflow } from "../../src/runtime/subrun.js";
import type { WorkflowRuntime } from "../../src/runtime/workflow-runtime.js";
import { WorkflowRuntime as RealWorkflowRuntime } from "../../src/runtime/workflow-runtime.js";
import { ExecutorRegistry } from "../../src/runtime/executor-registry.js";
import { ManualExecutor, ReturnExecutor } from "../../src/executors/index.js";

const dummyWorkflow = {
  id: "sub", version: "1", title: "Sub",
  entryNodeIds: [], nodes: [], edges: [],
};

describe("executeSubWorkflow", () => {
  it("委托给 runtime.runSubWorkflow", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: "ok" });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    const result = await executeSubWorkflow(runtime, dummyWorkflow, { input: "x" }, {
      parentRunId: "parent-1",
      maxDepth: 3,
    });

    expect(runSubWorkflow).toHaveBeenCalledOnce();
    expect(result.finalOutput).toBe("ok");
  });

  it("透传 parentRunId, signal, maxDepth, config 到 runSubWorkflow", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: {} });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;
    const abortController = new AbortController();
    const config = { model: { provider: "openai", model: "gpt-4o-mini" } };

    await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "parent-1",
      signal: abortController.signal,
      maxDepth: 5,
      config,
    });

    expect(runSubWorkflow).toHaveBeenCalledWith(
      dummyWorkflow,
      {},
      expect.objectContaining({
        parentRunId: "parent-1",
        signal: abortController.signal,
        maxDepth: 5,
        config,
      }),
    );
  });

  it("返回 { finalOutput } 结构", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: { result: 42 } });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    const result = await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "p1",
      maxDepth: 3,
    });

    expect(result).toEqual({ finalOutput: { result: 42 } });
  });

  it("runSubWorkflow 抛出时向上传播错误", async () => {
    const runSubWorkflow = vi.fn().mockRejectedValue(new Error("sub failed"));
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    await expect(executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "p1",
      maxDepth: 3,
    })).rejects.toThrow("sub failed");
  });

  it("不传 signal 时仍然正常工作", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: "ok" });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    const result = await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "p1",
      maxDepth: 3,
    });

    expect(result.finalOutput).toBe("ok");
  });

  it("不传 config 时仍然正常工作", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: "ok" });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    const result = await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "p1",
      maxDepth: 3,
    });

    expect(result.finalOutput).toBe("ok");
  });

  it("接收空 input 时正常执行", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: null });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    const result = await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "p1",
      maxDepth: 3,
    });

    expect(runSubWorkflow).toHaveBeenCalledWith(dummyWorkflow, {}, expect.any(Object));
  });

  it("不同 parentRunId 区分子工作流归属", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: {} });
    const runtime = { runSubWorkflow } as unknown as WorkflowRuntime;

    await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "a",
      maxDepth: 3,
    });
    await executeSubWorkflow(runtime, dummyWorkflow, {}, {
      parentRunId: "b",
      maxDepth: 3,
    });

    expect(runSubWorkflow).toHaveBeenCalledTimes(2);
    expect(runSubWorkflow.mock.calls[0][2].parentRunId).toBe("a");
    expect(runSubWorkflow.mock.calls[1][2].parentRunId).toBe("b");
  });

  it("真实 runtime 中子工作流事件不会写入父 trace", async () => {
    const registry = new ExecutorRegistry();
    registry.register("manual", new ManualExecutor((input) => input));
    registry.register("return", new ReturnExecutor());
    const runtime = new RealWorkflowRuntime({ executorRegistry: registry });

    await runtime.runSubWorkflow({
      id: "sub-real",
      version: "1",
      title: "Sub",
      entryNodeIds: ["m1"],
      nodes: [
        {
          id: "m1",
          title: "Manual",
          kind: "manual",
          dependsOn: [],
          inputBindings: {
            value: { from: "literal", value: "ok" },
          },
          output: { to: "result", mergeStrategy: "replace" },
        },
      ],
      edges: [],
    }, {}, {
      parentRunId: "parent-1",
      maxDepth: 3,
    });

    expect(runtime.getEventTrace()).toEqual([]);
  });

  it("真实 runtime 中 maxDepth 为 0 时拒绝子工作流", async () => {
    const runtime = new RealWorkflowRuntime();

    await expect(runtime.runSubWorkflow(dummyWorkflow, {}, {
      parentRunId: "parent-1",
      maxDepth: 0,
    })).rejects.toThrow("递归深度超限");
  });
});
