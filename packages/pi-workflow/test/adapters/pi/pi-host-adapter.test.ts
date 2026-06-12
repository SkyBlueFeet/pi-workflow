import { afterEach, describe, expect, it, vi } from "vitest";
import { MockPiHostAdapter } from "../../../src/adapters/pi/pi-mock-host.js";
import { PiCapabilityCatalogBuilder, resolvePackageSource } from "../../../src/adapters/pi/pi-capability-catalog.js";
import { mapHostEventToRuntimeEvent } from "../../../src/adapters/pi/pi-event-mapper.js";

describe("MockPiHostAdapter", () => {
  it("返回预设的 mock agent 输出", async () => {
    const mock = new MockPiHostAdapter();
    mock.setResponse("n1", "Hello from mock agent");

    const gen = mock.runAgent({
      nodeId: "n1", systemPrompt: "", prompt: "test", input: {},
    });

    let content = "";
    for await (const event of gen) {
      if (event.type === "agent.text_delta") content += event.delta;
    }

    expect(content).toBe("Hello from mock agent");
  });

  it("MockPiHostAdapter 支持 runNamedAgent", async () => {
    const mock = new MockPiHostAdapter();
    mock.setResponse("writer", "Hello from named agent");

    const gen = mock.runNamedAgent({ agentId: "writer", prompt: "write" });

    let content = "";
    for await (const event of gen) {
      if (event.type === "agent.text_delta") content += event.delta;
    }

    expect(content).toBe("Hello from named agent");
  });

  it("MockPiHostAdapter 对 echo 工具返回真实参数回显", async () => {
    const mock = new MockPiHostAdapter();
    const result = await mock.callTool({
      nodeId: "tool-1",
      toolName: "echo",
      params: {
        ticketId: "RST-1",
        warehouse: "North Hub",
      },
    });

    expect(result).toEqual({
      content: "{\"ticketId\":\"RST-1\",\"warehouse\":\"North Hub\"}",
      isError: false,
      details: {
        ticketId: "RST-1",
        warehouse: "North Hub",
      },
    });
  });
});

describe("PiCapabilityCatalogBuilder", () => {
  it("构建能力目录", () => {
    const builder = new PiCapabilityCatalogBuilder();
    builder.addPackage({ alias: "mypkg", source: "npm:@scope/pi-pkg" });
    builder.addSkill({ name: "analyze", packageSource: "mypkg" });
    builder.addTool({ name: "search", packageSource: "mypkg" });
    builder.addPrompt({ name: "greeting", packageSource: "mypkg" });

    const catalog = builder.build();
    expect(catalog.packages).toHaveLength(1);
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.tools).toHaveLength(1);
    expect(catalog.prompts).toHaveLength(1);
  });
});

describe("resolvePackageSource", () => {
  it("解析 npm: 前缀", () => {
    const r = resolvePackageSource("npm:@scope/pi-pkg");
    expect(r.type).toBe("npm");
    expect(r.path).toBe("@scope/pi-pkg");
  });

  it("裸名称默认为 npm", () => {
    const r = resolvePackageSource("pi-tools");
    expect(r.type).toBe("npm");
  });

  it("git: 前缀", () => {
    const r = resolvePackageSource("git:github.com/user/repo");
    expect(r.type).toBe("git");
  });
});

describe("mapHostEventToRuntimeEvent", () => {
  it("映射 text_delta 到结构化 agent.message.delta", () => {
    const r = mapHostEventToRuntimeEvent(
      { type: "agent.text_delta", delta: "hello" },
      "run-1", "n1",
    );
    expect(r?.type).toBe("agent.message.delta");
    if (r?.type === "agent.message.delta") {
      expect(r.delta).toBe("hello");
    }
  });

  it("映射 agent.error 到 node.failed", () => {
    const r = mapHostEventToRuntimeEvent(
      { type: "agent.error", error: "oops" },
      "run-1", "n1",
    );
    expect(r?.type).toBe("node.failed");
  });
});

describe("PiHostAdapter requestUserInput", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("将编号输入解析为已批准的选项结果", async () => {
    const questionMock = vi.fn((_prompt: string, callback: (answer: string) => void) => callback("1"));
    const closeMock = vi.fn();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.doMock("node:readline", () => ({
      createInterface: () => ({
        question: questionMock,
        close: closeMock,
      }),
    }));

    const { PiHostAdapter: ReloadedPiHostAdapter } = await import("../../../src/adapters/pi/pi-host-adapter.js?parse-approved-choice");
    const adapter = new ReloadedPiHostAdapter();
    const result = await adapter.requestUserInput({
      nodeId: "n1",
      interactionId: "n1/permission/extension.execute",
      question: "是否允许继续执行？",
      expectedFormat: "choice",
      options: ["允许一次", "拒绝"],
      required: true,
    });

    expect(questionMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(result.input["approved"]).toBe(true);
    expect(result.input["answer"]).toBe("允许一次");
    expect(result.input["selected"]).toBe("允许一次");
    logSpy.mockRestore();
  });

  it("提问前先通过协调器输出完整问题与选项", async () => {
    const questionMock = vi.fn((_prompt: string, callback: (answer: string) => void) => callback("2"));
    const closeMock = vi.fn();
    const beforePromptMock = vi.fn();
    const afterPromptMock = vi.fn();

    vi.doMock("node:readline", () => ({
      createInterface: () => ({
        question: questionMock,
        close: closeMock,
      }),
    }));

    const { PiHostAdapter: ReloadedPiHostAdapter } = await import("../../../src/adapters/pi/pi-host-adapter.js?prompt-coordinator");
    const adapter = new ReloadedPiHostAdapter({
      terminalCoordinator: {
        beforePrompt: beforePromptMock,
        afterPrompt: afterPromptMock,
      },
    });

    await adapter.requestUserInput({
      nodeId: "n1",
      interactionId: "n1/permission/network.request",
      question: "是否允许网络访问？",
      expectedFormat: "choice",
      options: ["允许一次", "拒绝"],
      required: true,
    });

    expect(beforePromptMock).toHaveBeenCalledWith([
      "",
      "[ask_user] 是否允许网络访问？",
      "  1. 允许一次",
      "  2. 拒绝",
    ]);
    expect(afterPromptMock).toHaveBeenCalled();
  });
});
