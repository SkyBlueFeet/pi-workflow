import { describe, it, expect } from "vitest";
import { ToolExecutor } from "../../src/executors/tool-executor.js";
import { PiHostAdapter } from "../../src/adapters/pi/pi-host-adapter.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";

const mockNode: WorkflowNodeIR = {
  id: "tool-node",
  title: "Tool Node",
  kind: "tool",
  dependsOn: [],
  inputBindings: {},
};

function makeContext(host: any, input: Record<string, unknown>): ExecutionContext {
  return {
    runId: "test-run",
    nodeId: "tool-node",
    nodeInput: input,
    sharedContext: {},
    host,
  };
}

describe("ToolExecutor 回退到宿主 callTool", () => {
  it("已注册本地工具优先于宿主工具", async () => {
    const host = new PiHostAdapter({
      builtinTools: [{
        name: "hello",
        source: "builtin",
        execute: async () => ({ content: "from host", isError: false }),
      }],
    });
    const executor = new ToolExecutor();
    executor.register("hello", async () => ({ fromLocal: true }));

    const result = await executor.execute(mockNode, makeContext(host, {
      toolName: "hello",
      params: {},
    }));
    expect(result.output).toEqual({ fromLocal: true });
  });

  it("本地工具缺失时调用 host.callTool()", async () => {
    const host = new PiHostAdapter({
      builtinTools: [{
        name: "host_tool",
        source: "builtin",
        execute: async () => ({ content: "from host callTool", isError: false }),
      }],
    });
    const executor = new ToolExecutor();

    const result = await executor.execute(mockNode, makeContext(host, {
      toolName: "host_tool",
      params: {},
    }));
    expect(result.output).toHaveProperty("content", "from host callTool");
  });

  it("无宿主能力时返回 unsupported 错误", async () => {
    const executor = new ToolExecutor();

    const result = await executor.execute(mockNode, makeContext({}, {
      toolName: "nope",
      params: {},
    }));
    expect(result.output).toHaveProperty("error");
  });

  it("宿主 callTool 返回错误时 artifact 仍按 tool 落地", async () => {
    const host = new PiHostAdapter({
      builtinTools: [{
        name: "failing",
        source: "builtin",
        execute: async () => ({ content: "失败了", isError: true }),
      }],
    });
    const executor = new ToolExecutor();

    const result = await executor.execute(mockNode, makeContext(host, {
      toolName: "failing",
      params: {},
    }));
    expect(result.output).toHaveProperty("content", "失败了");
    expect(result.output).toHaveProperty("isError", true);
    expect(result.artifacts?.some(a => a.type === "tool")).toBe(true);
  });
});
