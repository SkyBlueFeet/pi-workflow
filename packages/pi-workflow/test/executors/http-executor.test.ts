import { describe, it, expect } from "vitest";
import { HttpExecutor } from "../../src/executors/http-executor.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";
import { NullWorkflowHost } from "../../src/host/null-host.js";

const mockNode: WorkflowNodeIR = {
  id: "http-node",
  title: "HTTP Node",
  kind: "http",
  dependsOn: [],
  inputBindings: {},
};

function makeContext(input: Record<string, unknown>): ExecutionContext {
  return {
    runId: "test-run",
    nodeId: "http-node",
    nodeInput: input,
    sharedContext: {},
    host: NullWorkflowHost,
  };
}

describe("HttpExecutor", () => {
  it("url 缺失时返回 error", async () => {
    const executor = new HttpExecutor();
    const result = await executor.execute(mockNode, makeContext({}));
    expect(result.output).toHaveProperty("error");
  });

  it("无效 url 时返回 error 而非抛异常", async () => {
    const executor = new HttpExecutor();
    const result = await executor.execute(mockNode, makeContext({
      url: "http://invalid.localhost:1",
      timeoutMs: 100,
    }));
    expect(result.output).toHaveProperty("error");
  });
});
