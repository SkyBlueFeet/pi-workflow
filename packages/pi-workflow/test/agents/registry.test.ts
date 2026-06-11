import { describe, expect, it, beforeEach } from "vitest";
import { AgentRegistry, createRegistryFromConfig } from "../../src/agents/registry.js";
import type { AgentDefinition } from "../../src/agents/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("注册后返回标准化 assembly", () => {
    const def: AgentDefinition = {
      id: "writer",
      name: "Writer",
      systemPrompt: "You are a writer.",
      temperature: 0.4,
      maxTokens: 4096,
      workflowTools: {
        summarize: {
          workflow: { id: "wf", version: "1", title: "wf", entryNodeIds: [], nodes: [], edges: [] },
        },
      },
    };

    registry.register(def);
    const resolved = registry.get("writer");
    expect(resolved?.id).toBe("writer");
    expect(resolved?.runtimeMode).toBe("pi-tui");
    expect(resolved?.model?.temperature).toBe(0.4);
    expect(resolved?.model?.maxTokens).toBe(4096);
    expect(Object.keys(resolved?.workflowOverlay.workflowTools ?? {})).toEqual(["summarize"]);
  });

  it("list 返回所有标准化智能体", () => {
    registry.register({ id: "a", name: "A" } as AgentDefinition);
    registry.register({ id: "b", name: "B" } as AgentDefinition);
    expect(registry.list()).toHaveLength(2);
    expect(registry.list().map((a) => a.id).sort()).toEqual(["a", "b"]);
  });

  it("has/remove/clear 正确维护索引", () => {
    registry.register({ id: "x" } as AgentDefinition);
    expect(registry.has("x")).toBe(true);
    expect(registry.remove("x")).toBe(true);
    expect(registry.has("x")).toBe(false);
    registry.register({ id: "y" } as AgentDefinition);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it("loadFromConfig 从 WorkflowConfig.agents 批量加载并归一化 legacy 字段", () => {
    const config: WorkflowConfig = {
      agents: {
        writer: {
          systemPrompt: "You are a writer.",
          temperature: 0.3,
          maxTokens: 2048,
          tools: [{ name: "read" }],
        },
      },
    };

    registry.loadFromConfig(config);
    const writer = registry.get("writer");
    expect(writer?.systemPrompt).toBe("You are a writer.");
    expect(writer?.model?.temperature).toBe(0.3);
    expect(writer?.model?.maxTokens).toBe(2048);
    expect(writer?.tools).toEqual([{ type: "builtin", name: "read", source: "builtin" }]);
    expect(writer?.diagnostics.some((item) => item.code === "agent.tools.legacy.default-builtin")).toBe(true);
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
        agent1: { name: "Agent 1", runtime: { mode: "pi-tui" } },
      },
    };
    const registry = createRegistryFromConfig(config);
    expect(registry.has("agent1")).toBe(true);
    expect(registry.get("agent1")?.name).toBe("Agent 1");
    expect(registry.get("agent1")?.runtimeMode).toBe("pi-tui");
  });

  it("无 agents 配置时返回空注册中心", () => {
    const registry = createRegistryFromConfig({});
    expect(registry.list()).toHaveLength(0);
  });
});
