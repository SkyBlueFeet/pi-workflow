import { describe, it, expect } from "vitest";
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
  it("映射 text_delta 到 node.progress", () => {
    const r = mapHostEventToRuntimeEvent(
      { type: "agent.text_delta", delta: "hello" },
      "run-1", "n1",
    );
    expect(r?.type).toBe("node.progress");
    if (r?.type === "node.progress") {
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
