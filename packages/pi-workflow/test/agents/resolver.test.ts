import { describe, expect, it } from "vitest";
import { resolveAgentConfig, resolveAgentModelSettings } from "../../src/agents/resolver.js";
import { AgentRegistry } from "../../src/agents/registry.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

function makeNode(overrides?: Partial<WorkflowNodeIR>): WorkflowNodeIR {
  return {
    id: "node1",
    title: "Node 1",
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    ...overrides,
  };
}

function makeRegistry(agents?: WorkflowConfig["agents"]): AgentRegistry {
  const registry = new AgentRegistry();
  if (agents) registry.loadFromConfig({ agents });
  return registry;
}

describe("resolveAgentConfig", () => {
  it("无 agentId 时回退到全局默认值并默认 runtime 为 pi-tui", () => {
    const node = makeNode();
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry());
    expect(resolved.prompt.systemPrompt).toBe("You are a helpful assistant.");
    expect(resolved.model?.provider).toBe("openai");
    expect(resolved.model?.name).toBe("gpt-4o-mini");
    expect(resolved.runtimeMode).toBe("pi-tui");
    expect(resolved.workflowTools).toEqual([]);
  });

  it("agentId 引用智能体定义并收口到 resolved assembly", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
    });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini", temperature: 0.7 },
      agents: {
        writer: {
          systemPrompt: "You are a writer.",
          model: { provider: "anthropic", model: "claude-3-7-sonnet" },
          temperature: 0.4,
          maxTokens: 4096,
          skills: [{ name: "outline" }],
          tools: [{ name: "read" }],
          mcp: [{ server: "ctx7" }],
        },
      },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry(config.agents));
    expect(resolved.prompt.systemPrompt).toBe("You are a writer.");
    expect(resolved.model?.id).toBe("anthropic/claude-3-7-sonnet");
    expect(resolved.model?.temperature).toBe(0.4);
    expect(resolved.model?.maxTokens).toBe(4096);
    expect(resolved.tools).toEqual([{ type: "builtin", name: "read", source: "builtin" }]);
    expect(resolved.executableTools[0].requiredPermissions[0].capability).toBe("fs.read");
    expect(resolved.mcp.map((m) => m.server)).toEqual(["ctx7"]);
  });

  it("节点 literal 输入覆盖系统提示词", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
      inputBindings: {
        system_prompt: { from: "literal", value: "Overridden prompt" },
      },
    });
    const config: WorkflowConfig = {
      agents: { writer: { systemPrompt: "Original prompt" } },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry(config.agents));
    expect(resolved.prompt.systemPrompt).toBe("Overridden prompt");
  });

  it("节点 capabilities 以 append 方式叠加 skills/tools/mcp 并按稳定键去重", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
      capabilities: {
        skills: [{ name: "outline" }, { name: "review" }],
        tools: [{ name: "read" }, { name: "search", source: "native" }],
        mcp: [{ server: "ctx7" }, { server: "ctx8" }],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        writer: {
          skills: [{ name: "outline" }, { name: "analyze" }],
          tools: [{ name: "read" }],
          mcp: [{ server: "ctx7" }],
        },
      },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry(config.agents));
    expect(resolved.skills.map((s) => s.name)).toEqual(["outline", "analyze", "review"]);
    expect(resolved.tools.map((t) => `${t.type}:${t.name}`)).toEqual(["builtin:read", "native:search"]);
    expect(resolved.mcp.map((m) => m.server)).toEqual(["ctx7", "ctx8"]);
  });

  it("将 legacy 顶层 workflowTools 收口到 workflowOverlay 并解析为 ResolvedWorkflowTool", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "helper" } },
      capabilities: {
        tools: [{ name: "summarize", source: "workflow" }],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        helper: {
          workflowTools: {
            summarize: {
              workflow: { id: "wf1", version: "1", title: "wf1", entryNodeIds: [], nodes: [], edges: [] },
            },
          },
        },
      },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry(config.agents));
    expect(resolved.workflowTools).toHaveLength(1);
    expect(resolved.workflowTools[0].name).toBe("summarize");
    expect(resolved.executableTools[0].ref.type).toBe("workflow");
  });

  it("workflow 节点当前不支持外部 agent 文件地址引用", () => {
    const node = makeNode({
      executor: {
        type: "agent",
        config: { agentConfigPath: "./agents/external.toml", agentRef: "writer" },
      },
    });

    const resolved = resolveAgentConfig(node, { baseDir: process.cwd() }, makeRegistry());
    expect(resolved.diagnostics.some((item) => item.code === "agent.external.unsupported")).toBe(true);
  });

  it("resolveAgentModelSettings 读取 nodeInput.model.* 覆盖并回退到 resolved model", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
    });
    const config: WorkflowConfig = {
      agents: {
        writer: {
          model: { provider: "anthropic", model: "claude-3-7-sonnet", temperature: 0.4, maxTokens: 4096 },
        },
      },
    };

    const resolved = resolveAgentConfig(node, config, makeRegistry(config.agents));
    const settings = resolveAgentModelSettings(node, {
      model: { provider: "openai", model: "gpt-4o-mini", temperature: 0.1, maxTokens: 512 },
    }, resolved);

    expect(settings.model).toBe("openai/gpt-4o-mini");
    expect(settings.temperature).toBe(0.1);
    expect(settings.maxTokens).toBe(512);
  });
});
