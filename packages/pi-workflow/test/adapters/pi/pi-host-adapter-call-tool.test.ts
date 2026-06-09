import { describe, it, expect } from "vitest";
import { PiHostAdapter } from "../../../src/adapters/pi/pi-host-adapter.js";
import type { HostCallableToolRecord } from "../../../src/adapters/pi/types.js";

const builtinEcho: HostCallableToolRecord = {
  name: "echo",
  description: "Echo back params",
  source: "builtin",
  execute: async (params) => ({
    content: JSON.stringify(params),
    isError: false,
  }),
};

const extensionReverse: HostCallableToolRecord = {
  name: "reverse",
  description: "Reverse a string",
  capability: "extension.execute",
  source: "extension",
  execute: async (params) => ({
    content: (params["text"] as string ?? "").split("").reverse().join(""),
    isError: false,
  }),
};

function readLastAgentToolNames(adapter: PiHostAdapter): readonly string[] {
  return (adapter as unknown as { lastAgentToolNames: readonly string[] }).lastAgentToolNames;
}

describe("PiHostAdapter.callTool", () => {
  it("built-in 工具可被命中", async () => {
    const adapter = new PiHostAdapter({ builtinTools: [builtinEcho] });
    const result = await adapter.callTool({ toolName: "echo", params: { message: "hello" } });
    expect(result.isError).toBe(false);
    expect(result.content).toBe('{"message":"hello"}');
  });

  it("工具不存在时返回错误", async () => {
    const adapter = new PiHostAdapter({ builtinTools: [builtinEcho] });
    const result = await adapter.callTool({ toolName: "nonexistent", params: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("工具未找到");
  });

  it("extension 工具可被命中", async () => {
    const adapter = new PiHostAdapter({
      extensionTools: [{
        name: extensionReverse.name,
        description: extensionReverse.description,
        execute: extensionReverse.execute,
      }],
    });
    const result = await adapter.callTool({ toolName: "reverse", params: { text: "hello" } });
    expect(result.isError).toBe(false);
    expect(result.content).toBe("olleh");
  });

  it("built-in 优先于 extension 同名工具", async () => {
    const extTool: HostCallableToolRecord = {
      name: "echo",
      source: "extension",
      execute: async () => ({ content: "from extension", isError: false }),
    };
    const adapter = new PiHostAdapter({
      builtinTools: [builtinEcho],
      extensionTools: [{
        name: extTool.name,
        execute: extTool.execute,
      }],
    });
    const result = await adapter.callTool({ toolName: "echo", params: { x: 1 } });
    expect(result.content).toBe('{"x":1}');
  });

  it("native 工具可被命中", async () => {
    const adapter = new PiHostAdapter({
      nativeTools: [{
        name: "native_tool",
        description: "A native tool",
        execute: async () => ({ content: "native result", isError: false }),
      }],
    });
    const result = await adapter.callTool({ toolName: "native_tool", params: {} });
    expect(result.isError).toBe(false);
    expect(result.content).toBe("native result");
  });

  it("工具 details 会透传到 WorkflowToolResult", async () => {
    const adapter = new PiHostAdapter({
      builtinTools: [{
        name: "with_details",
        source: "builtin",
        execute: async () => ({
          content: "ok",
          isError: false,
          details: { patch: "diff" },
        }),
      }],
    });
    const result = await adapter.callTool({ toolName: "with_details", params: {} });
    expect(result.details).toEqual({ patch: "diff" });
  });

  it("权限拒绝时返回错误", async () => {
    const adapter = new PiHostAdapter({
      builtinTools: [{
        name: "secured",
        capability: "fs.read",
        source: "builtin",
        execute: async () => ({ content: "secret", isError: false }),
      }],
      permissionCheck: async (cap) => {
        if (cap === "fs.read") return { allowed: false, reason: "测试拒绝" };
        return { allowed: true };
      },
    });
    const result = await adapter.callTool({ toolName: "secured", params: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("测试拒绝");
  });

  it("工具抛异常时不会继续向外抛", async () => {
    const adapter = new PiHostAdapter({
      builtinTools: [{
        name: "crash",
        source: "builtin",
        execute: async () => { throw new Error("内部错误"); },
      }],
    });
    const result = await adapter.callTool({ toolName: "crash", params: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("内部错误");
  });

  it("未在请求中显式声明工具时不会自动暴露宿主注册表工具给 agent", async () => {
    const adapter = new PiHostAdapter({ builtinTools: [builtinEcho] });
    const gen = adapter.runAgent({
      nodeId: "agent-node",
      prompt: "hello",
      input: {},
      model: "missing/model",
    });

    await gen.next();
    expect(readLastAgentToolNames(adapter)).toEqual([]);
  });

  it("只有请求中显式声明的工具会传给 agent", async () => {
    const adapter = new PiHostAdapter({ builtinTools: [builtinEcho] });
    const gen = adapter.runAgent({
      nodeId: "agent-node",
      prompt: "hello",
      input: {},
      model: "missing/model",
      tools: [{ name: "echo" }],
      toolExecutors: [{
        name: "echo",
        execute: async () => ({ content: "ok", isError: false }),
      }],
    });

    await gen.next();
    expect(readLastAgentToolNames(adapter)).toEqual(["echo"]);
  });
});
