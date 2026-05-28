import { describe, it, expect } from "vitest";
import { loadFromObject } from "../../src/dsl/loader.js";
import { dslToIr } from "../../src/dsl/mapper.js";

describe("agent node validation", () => {
  it("正确的 agent 配置通过验证", () => {
    const { diagnostics } = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [{
        id: "a", title: "Agent", executor: { type: "agent", skillId: "test" },
        inputs: {
          system_prompt: { from: "literal", value: "You are helpful." },
          user_prompt: { from: "literal", value: "Hi" },
        },
        capabilities: {
          skills: [{ name: "analyze", source: "@pi/tools" }],
          tools: [{ name: "search", description: "Search" }],
          mcp: [{ server: "npx mcp-server", args: ["--port", "8080"] }],
        },
      }],
    });
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("agent skills 缺少 name 时报错", () => {
    const { diagnostics } = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [{
        id: "a", title: "Agent", executor: { type: "agent" },
        capabilities: { skills: [{ source: "@pi/tools" }] as any },
      }],
    });
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe("DSL-009");
  });

  it("agent mcp 缺少 server 时报错", () => {
    const { diagnostics } = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [{
        id: "a", title: "Agent", executor: { type: "agent" },
        capabilities: { mcp: [{ args: ["/data"] } as any] },
      }],
    });
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe("DSL-009");
  });

  it("agent 配置映射到 IR 保留完整结构", () => {
    const { document } = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [{
        id: "a", title: "Agent", executor: { type: "agent" },
        inputs: {
          system_prompt: { from: "literal", value: "You are helpful." },
          user_prompt: { from: "literal", value: "Hi" },
        },
        capabilities: {
          skills: [{ name: "analyze", source: "@pi/tools", params: { detail: true } }],
          tools: [{ name: "search", description: "Search KB" }],
        },
      }],
    });
    const ir = dslToIr(document);
    const node = ir.nodes[0];

    expect(node.kind).toBe("agent");
    expect(node.capabilities).toBeDefined();
    expect(node.capabilities!.skills).toHaveLength(1);
    expect(node.capabilities!.skills![0].name).toBe("analyze");
    expect(node.capabilities!.skills![0].params).toEqual({ detail: true });
    expect(node.capabilities!.tools).toHaveLength(1);
    expect(node.capabilities!.tools![0].name).toBe("search");
  });
});
