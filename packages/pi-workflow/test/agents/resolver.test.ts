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
  it("无 agentId 时回退到全局默认值", () => {
    const node = makeNode();
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
    };
    const registry = makeRegistry();

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.systemPrompt).toBe("You are a helpful assistant.");
    expect(resolved.model?.provider).toBe("openai");
    expect(resolved.model?.model).toBe("gpt-4o-mini");
    expect(resolved.skills).toEqual([]);
    expect(resolved.tools).toEqual([]);
    expect(resolved.workflowTools).toEqual({});
    expect(resolved.mcp).toEqual([]);
  });

  it("agentId 引用智能体定义并提供合并配置", () => {
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
          mcp: [{ server: "ctx7" }],
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.systemPrompt).toBe("You are a writer.");
    expect(resolved.model?.provider).toBe("anthropic");
    expect(resolved.model?.model).toBe("claude-3-7-sonnet");
    expect(resolved.temperature).toBe(0.4);
    expect(resolved.maxTokens).toBe(4096);
    expect(resolved.skills).toHaveLength(1);
    expect(resolved.skills[0].name).toBe("outline");
    expect(resolved.mcp).toHaveLength(1);
    expect(resolved.mcp[0].server).toBe("ctx7");
  });

  it("节点输入 system_prompt 覆盖智能体定义", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
      inputBindings: {
        system_prompt: { from: "literal", value: "Overridden prompt" },
      },
    });
    const config: WorkflowConfig = {
      agents: { writer: { systemPrompt: "Original prompt" } },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);

    expect(resolved.systemPrompt).toBe("Overridden prompt");
  });

  it("节点 inputBindings 不含 user_prompt 时 userPrompt 为 undefined", () => {
    const node = makeNode({
      inputBindings: {},
    });
    const config: WorkflowConfig = {};
    const registry = makeRegistry();

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.userPrompt).toBeUndefined();
  });

  it("节点输入 user_prompt 支持从 literal 绑定解析", () => {
    const node = makeNode({
      inputBindings: {
        user_prompt: { from: "literal", value: "Write a summary" },
      },
    });
    const registry = makeRegistry();

    const resolved = resolveAgentConfig(node, {}, registry);
    expect(resolved.userPrompt).toBe("Write a summary");
  });

  it("节点 capabilities 中的 skills 与智能体技能去重合并", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
      capabilities: {
        skills: [
          { name: "outline" },
          { name: "review" },
        ],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        writer: {
          skills: [
            { name: "outline" },
            { name: "analyze" },
          ],
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.skills.map(s => s.name)).toEqual(["outline", "analyze", "review"]);
  });

  it("tools 按 name+source 去重合并", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "helper" } },
      capabilities: {
        tools: [
          { name: "search", source: "web" },
          { name: "calc" },
        ],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        helper: {
          tools: [
            { name: "search", source: "web" },
            { name: "read" },
          ],
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.tools.map(t => t.name)).toEqual(["search", "read", "calc"]);
  });

  it("workflow tools 仅从智能体定义和节点显式引用合并", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "helper" } },
      capabilities: {
        tools: [
          { name: "nodeTool", source: "workflow", description: "from node" },
        ],
      },
    });
    const config: WorkflowConfig = {
      workflowTools: {
        globalTool: { workflow: { id: "g", version: "1", title: "G", entryNodeIds: [], nodes: [], edges: [] } },
      },
      agents: {
        helper: {
          workflowTools: {
            agentTool: { workflow: { id: "a", version: "1", title: "A", entryNodeIds: [], nodes: [], edges: [] } },
          },
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(Object.keys(resolved.workflowTools)).toEqual(["agentTool", "nodeTool"]);
    expect(resolved.workflowTools["globalTool"]).toBeUndefined();
    expect(resolved.workflowTools["agentTool"].name).toBe("agentTool");
  });

  it("全局 workflowTools 可作为节点显式引用的定义来源", () => {
    const node = makeNode({
      capabilities: {
        tools: [
          { name: "globalTool", source: "workflow" },
        ],
      },
    });
    const config: WorkflowConfig = {
      workflowTools: {
        globalTool: {
          workflow: { id: "g", version: "1", title: "G", entryNodeIds: [], nodes: [], edges: [] },
          description: "global definition",
        },
      },
    };
    const registry = makeRegistry();

    const resolved = resolveAgentConfig(node, config, registry);
    expect(Object.keys(resolved.workflowTools)).toEqual(["globalTool"]);
    expect(resolved.workflowTools["globalTool"].description).toBe("global definition");
    expect(resolved.workflowTools["globalTool"].workflow.id).toBe("g");
  });

  it("同名 workflow tool 节点级覆盖智能体级", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "helper" } },
      capabilities: {
        tools: [
          { name: "shared", source: "workflow", description: "node version" },
        ],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        helper: {
          workflowTools: {
            shared: { workflow: { id: "a", version: "1", title: "A", entryNodeIds: [], nodes: [], edges: [] }, description: "agent version" },
          },
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.workflowTools["shared"].description).toBe("node version");
  });

  it("同名 workflow tool 节点级覆盖全局级", () => {
    const node = makeNode({
      capabilities: {
        tools: [
          { name: "shared", source: "workflow", description: "node version" },
        ],
      },
    });
    const config: WorkflowConfig = {
      workflowTools: {
        shared: {
          workflow: { id: "g", version: "1", title: "G", entryNodeIds: [], nodes: [], edges: [] },
          description: "global version",
        },
      },
    };
    const registry = makeRegistry();

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.workflowTools["shared"].description).toBe("node version");
  });

  it("MCP 按 server 名称去重合并", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "helper" } },
      capabilities: {
        mcp: [
          { server: "serverB", args: ["--port", "9090"] },
        ],
      },
    });
    const config: WorkflowConfig = {
      agents: {
        helper: {
          mcp: [
            { server: "serverA" },
            { server: "serverB", args: ["--port", "8080"] },
          ],
        },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.mcp.map(m => m.server)).toEqual(["serverA", "serverB"]);
    expect(resolved.mcp[1].args?.[0]).toBe("--port");
  });

  it("模型配置：全局 -> 节点覆盖 -> 智能体覆盖", () => {
    const node = makeNode({
      id: "node1",
      executor: { type: "agent", config: { agentId: "writer" } },
    });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini", temperature: 0.7 },
      nodes: {
        node1: { model: { temperature: 0.3 } },
      },
      agents: {
        writer: { model: { provider: "anthropic", model: "claude-3-7-sonnet" } },
      },
    };
    const registry = makeRegistry(config.agents);

    const resolved = resolveAgentConfig(node, config, registry);
    expect(resolved.model?.provider).toBe("anthropic");
    expect(resolved.model?.model).toBe("claude-3-7-sonnet");
    expect(resolved.model?.temperature).toBe(0.3);
  });

  it("节点输入 model/temperature/max_tokens 通过 resolveAgentModelSettings 返回", () => {
    const node = makeNode();
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
    };
    const registry = makeRegistry();
    const resolved = resolveAgentConfig(node, config, registry);

    const settings = resolveAgentModelSettings(node, {
      model: "anthropic/claude-3-7-sonnet",
      temperature: 0.5,
      max_tokens: 2048,
    }, resolved);

    expect(settings.model).toBe("anthropic/claude-3-7-sonnet");
    expect(settings.temperature).toBe(0.5);
    expect(settings.maxTokens).toBe(2048);
  });

  it("resolveAgentModelSettings 回退到已解析配置", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
    });
    const config: WorkflowConfig = {
      agents: {
        writer: {
          model: { provider: "anthropic", model: "claude-3-7-sonnet" },
          temperature: 0.4,
          maxTokens: 4096,
        },
      },
    };
    const registry = makeRegistry(config.agents);
    const resolved = resolveAgentConfig(node, config, registry);

    const settings = resolveAgentModelSettings(node, {}, resolved);

    expect(settings.model).toBe("anthropic/claude-3-7-sonnet");
    expect(settings.temperature).toBe(0.4);
    expect(settings.maxTokens).toBe(4096);
  });

  it("无模型配置时 resolveAgentModelSettings 返回 undefined", () => {
    const node = makeNode();
    const config: WorkflowConfig = {};
    const registry = makeRegistry();
    const resolved = resolveAgentConfig(node, config, registry);

    const settings = resolveAgentModelSettings(node, {}, resolved);

    expect(settings.model).toBeUndefined();
  });

  it("级联规则：节点输入 > 智能体定义 > 节点配置 > 全局配置", () => {
    const node = makeNode({
      executor: { type: "agent", config: { agentId: "writer" } },
    });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o", temperature: 1.0, maxTokens: 1024 },
      nodes: {
        node1: { model: { temperature: 0.8 } },
      },
      agents: {
        writer: {
          model: { provider: "anthropic", model: "claude-3-haiku" },
          temperature: 0.5,
          maxTokens: 2048,
        },
      },
    };
    const registry = makeRegistry(config.agents);
    const resolved = resolveAgentConfig(node, config, registry);

    expect(resolved.model?.provider).toBe("anthropic");
    expect(resolved.model?.model).toBe("claude-3-haiku");

    const settings = resolveAgentModelSettings(node, {
      temperature: 0.1,
      max_tokens: 512,
    }, resolved);

    expect(settings.model).toBe("anthropic/claude-3-haiku");
    expect(settings.temperature).toBe(0.1);
    expect(settings.maxTokens).toBe(512);
  });
});
