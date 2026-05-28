import { describe, expect, it, beforeEach } from "vitest";
import { AgentRegistry, createRegistryFromConfig } from "../../src/agents/registry.js";
import type { AgentDefinition } from "../../src/agents/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("注册后可通过 get 获取", () => {
    const def: AgentDefinition = {
      id: "writer", name: "Writer",
      systemPrompt: "You are a writer.",
    };
    registry.register(def);
    expect(registry.get("writer")).toEqual(def);
  });

  it("list 返回所有已注册智能体", () => {
    registry.register({ id: "a", name: "A" } as AgentDefinition);
    registry.register({ id: "b", name: "B" } as AgentDefinition);
    expect(registry.list()).toHaveLength(2);
    expect(registry.list().map(a => a.id).sort()).toEqual(["a", "b"]);
  });

  it("has 正确判断存在性", () => {
    registry.register({ id: "x" } as AgentDefinition);
    expect(registry.has("x")).toBe(true);
    expect(registry.has("y")).toBe(false);
  });

  it("clear 清空所有注册", () => {
    registry.register({ id: "a" } as AgentDefinition);
    registry.register({ id: "b" } as AgentDefinition);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it("remove 删除指定智能体并返回 true", () => {
    registry.register({ id: "a" } as AgentDefinition);
    expect(registry.remove("a")).toBe(true);
    expect(registry.has("a")).toBe(false);
  });

  it("remove 不存在的 id 返回 false", () => {
    expect(registry.remove("nonexistent")).toBe(false);
  });

  it("loadFromConfig 从 WorkflowConfig.agents 批量加载", () => {
    const config: WorkflowConfig = {
      agents: {
        writer: { systemPrompt: "You are a writer." },
        reader: { systemPrompt: "You are a reader." },
      },
    };
    registry.loadFromConfig(config);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get("writer")?.systemPrompt).toBe("You are a writer.");
    expect(registry.get("reader")?.systemPrompt).toBe("You are a reader.");
  });

  it("loadFromConfig 在无 agents 时不报错", () => {
    registry.loadFromConfig({});
    expect(registry.list()).toHaveLength(0);
  });

  it("register 覆盖已存在的 id", () => {
    registry.register({ id: "a", systemPrompt: "v1" } as AgentDefinition);
    registry.register({ id: "a", systemPrompt: "v2" } as AgentDefinition);
    expect(registry.get("a")?.systemPrompt).toBe("v2");
  });
});

describe("createRegistryFromConfig", () => {
  it("创建并初始化注册中心", () => {
    const config: WorkflowConfig = {
      agents: {
        agent1: { name: "Agent 1" },
      },
    };
    const registry = createRegistryFromConfig(config);
    expect(registry.has("agent1")).toBe(true);
    expect(registry.get("agent1")?.name).toBe("Agent 1");
  });

  it("无 agents 配置时返回空注册中心", () => {
    const registry = createRegistryFromConfig({});
    expect(registry.list()).toHaveLength(0);
  });
});
