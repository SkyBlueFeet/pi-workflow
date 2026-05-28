import { describe, it, expect } from "vitest";
import { validateWorkflowConfig, validateModelString } from "../../src/config/validator.js";
import type { WorkflowDefinitionIR, WorkflowNodeIR } from "../../src/ir/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

function makeIr(nodes: WorkflowNodeIR[]): WorkflowDefinitionIR {
  return {
    id: "test-workflow",
    version: "1.0",
    title: "Test",
    entryNodeIds: nodes.length > 0 ? [nodes[0].id] : [],
    nodes,
    edges: [],
  };
}

function makeAgentNode(id: string, overrides: Partial<WorkflowNodeIR> = {}): WorkflowNodeIR {
  return {
    id,
    title: `Agent ${id}`,
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    ...overrides,
  };
}

function makeNonAgentNode(id: string, kind: WorkflowNodeIR["kind"] = "manual"): WorkflowNodeIR {
  return {
    id,
    title: `Node ${id}`,
    kind,
    dependsOn: [],
    inputBindings: {},
  };
}

describe("validateWorkflowConfig", () => {
  it("没有 agent 节点时总是通过", () => {
    const ir = makeIr([makeNonAgentNode("manual-1"), makeNonAgentNode("return-1", "return")]);
    const result = validateWorkflowConfig(ir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("agent 节点没有模型配置时报错", () => {
    const ir = makeIr([makeAgentNode("agent-1")]);
    const result = validateWorkflowConfig(ir);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].nodeId).toBe("agent-1");
    expect(result.errors[0].field).toBe("model");
  });

  it("agent 节点有全局默认配置时通过", () => {
    const ir = makeIr([makeAgentNode("agent-1")]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
    };
    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("agent 节点有节点级配置时通过", () => {
    const ir = makeIr([makeAgentNode("agent-1")]);
    const config: WorkflowConfig = {
      nodes: {
        "agent-1": { model: { provider: "anthropic", model: "claude-3-opus" } },
      },
    };
    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("多个 agent 节点中部分未配置时报错所有缺失的", () => {
    const ir = makeIr([
      makeAgentNode("agent-1"),
      makeAgentNode("agent-2"),
      makeNonAgentNode("manual-1"),
    ]);
    const config: WorkflowConfig = {
      nodes: {
        "agent-1": { model: { provider: "openai", model: "gpt-4" } },
      },
    };
    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].nodeId).toBe("agent-2");
  });

  it("所有 agent 节点都配置时通过", () => {
    const ir = makeIr([
      makeAgentNode("agent-1"),
      makeAgentNode("agent-2"),
    ]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o" },
      nodes: {
        "agent-2": { model: { provider: "anthropic", model: "claude-3-opus" } },
      },
    };
    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("workflowTools 相对路径基于 config.baseDir 校验", () => {
    const ir = makeIr([makeAgentNode("agent-1")]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      baseDir: "E:/repo/configs",
      workflowTools: {
        summarize: {
          workflowPath: "./flows/summarize.json",
        },
      },
    };

    const result = validateWorkflowConfig(ir, config, "E:/other-dir");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("workflowTools.summarize.workflowPath");
  });

  it("agent 定义中的模型可满足 agent 节点预检", () => {
    const ir = makeIr([
      makeAgentNode("agent-1", { executor: { type: "agent", config: { agentId: "writer" } } }),
    ]);
    const config: WorkflowConfig = {
      agents: {
        writer: {
          model: { provider: "anthropic", model: "claude-3-opus" },
        },
      },
    };

    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(true);
  });

  it("校验 agent 局部 workflowTools 的路径", () => {
    const ir = makeIr([
      makeAgentNode("agent-1", { executor: { type: "agent", config: { agentId: "writer" } } }),
    ]);
    const config: WorkflowConfig = {
      agents: {
        writer: {
          model: { provider: "openai", model: "gpt-4o-mini" },
          workflowTools: {
            summarize: {
              workflowPath: "./flows/missing.json",
            },
          },
        },
      },
      baseDir: "E:/repo/configs",
    };

    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("agents.writer.workflowTools.summarize.workflowPath");
  });

  it("agent 使用 MCP 但未授权 mcp.use 时预检失败", () => {
    const ir = makeIr([
      makeAgentNode("agent-1", { executor: { type: "agent", config: { agentId: "writer" } } }),
    ]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      security: {
        permissions: [{ capability: "extension.execute" }],
      },
      agents: {
        writer: {
          permissions: [{ capability: "extension.execute" }],
          mcp: [{ server: "ctx7" }],
        },
      },
    };

    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === "agents.writer.permissions" && error.message.includes("mcp.use"))).toBe(true);
  });

  it("agent workflowTools 权限超出父级范围时预检失败", () => {
    const ir = makeIr([
      makeAgentNode("agent-1", { executor: { type: "agent", config: { agentId: "writer" } } }),
    ]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      security: {
        permissions: [{ capability: "extension.execute" }, { capability: "workflow.invoke" }],
      },
      agents: {
        writer: {
          permissions: [{ capability: "extension.execute" }],
          workflowTools: {
            summarize: {
              workflow: makeIr([]),
              permissions: [{ capability: "workflow.invoke" }],
            },
          },
        },
      },
    };

    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === "agents.writer.workflowTools.summarize.permissions")).toBe(true);
  });

  it("workflowTools inline IR 与父工作流同 id 时预检失败", () => {
    const ir = makeIr([makeAgentNode("agent-1")]);
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      workflowTools: {
        self: {
          workflow: {
            id: "test-workflow",
            version: "1.0",
            title: "Self",
            entryNodeIds: [],
            nodes: [],
            edges: [],
          },
        },
      },
    };

    const result = validateWorkflowConfig(ir, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === "workflowTools.self.workflow" && error.message.includes("显式静态自引用"))).toBe(true);
  });
});

describe("validateModelString", () => {
  it("正确的 provider/model 格式返回 true", () => {
    expect(validateModelString("openai/gpt-4")).toBe(true);
  });

  it("缺少 provider 返回 false", () => {
    expect(validateModelString("/gpt-4")).toBe(false);
  });

  it("缺少 model 返回 false", () => {
    expect(validateModelString("openai/")).toBe(false);
  });

  it("空字符串返回 false", () => {
    expect(validateModelString("")).toBe(false);
  });

  it("没有斜杠返回 false", () => {
    expect(validateModelString("gpt-4")).toBe(false);
  });
});
