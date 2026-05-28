import { describe, it, expect } from "vitest";
import { ToolExecutor } from "../../src/executors/tool-executor.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";
import { NullWorkflowHost } from "../../src/host/null-host.js";

const mockNode: WorkflowNodeIR = {
  id: "tool-node",
  title: "Tool Node",
  kind: "tool",
  dependsOn: [],
  inputBindings: {},
};

function makeContext(input: Record<string, unknown>): ExecutionContext {
  return {
    runId: "test-run",
    nodeId: "tool-node",
    nodeInput: input,
    sharedContext: {},
    host: NullWorkflowHost,
  };
}

describe("ToolExecutor", () => {
  it("执行已注册的本地 tool", async () => {
    const executor = new ToolExecutor();
    executor.register("echo", async (params) => ({ echoed: params }));

    const result = await executor.execute(mockNode, makeContext({
      toolName: "echo",
      params: { message: "hello" },
    }));

    expect(result.output).toEqual({ echoed: { message: "hello" } });
  });

  it("toolName 缺失时返回 error artifact", async () => {
    const executor = new ToolExecutor();
    const result = await executor.execute(mockNode, makeContext({}));
    expect(result.output).toHaveProperty("error");
  });

  it("未注册 tool 且无 PI host 时返回 unsupported", async () => {
    const executor = new ToolExecutor();
    const result = await executor.execute(mockNode, makeContext({
      toolName: "nonexistent",
    }));
    expect(result.output).toHaveProperty("error");
  });
});
