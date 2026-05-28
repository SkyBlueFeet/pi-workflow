import { describe, it, expect } from "vitest";
import { resolveModelConfig, isModelConfigured, formatModelString } from "../../src/config/resolver.js";
import type { WorkflowNodeIR, WorkflowDefinitionIR } from "../../src/ir/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

function makeNode(overrides: Partial<WorkflowNodeIR> = {}): WorkflowNodeIR {
  return {
    id: "test-node",
    title: "Test Node",
    kind: "agent",
    dependsOn: [],
    inputBindings: {},
    ...overrides,
  };
}

describe("resolveModelConfig", () => {
  it("返回空对象当没有配置时", () => {
    const node = makeNode();
    const result = resolveModelConfig(node);
    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  it("使用全局默认配置", () => {
    const node = makeNode();
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
    };
    const result = resolveModelConfig(node, config);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("节点级配置覆盖全局默认", () => {
    const node = makeNode({ id: "my-agent" });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      nodes: {
        "my-agent": { model: { provider: "anthropic", model: "claude-3-opus" } },
      },
    };
    const result = resolveModelConfig(node, config);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-3-opus");
  });

  it("节点级部分覆盖全局默认", () => {
    const node = makeNode({ id: "my-agent" });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini", temperature: 0.7 },
      nodes: {
        "my-agent": { model: { temperature: 0.9 } },
      },
    };
    const result = resolveModelConfig(node, config);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.temperature).toBe(0.9);
  });

  it("不相关的节点配置不影响其他节点", () => {
    const node = makeNode({ id: "other-agent" });
    const config: WorkflowConfig = {
      model: { provider: "openai", model: "gpt-4o-mini" },
      nodes: {
        "my-agent": { model: { provider: "anthropic" } },
      },
    };
    const result = resolveModelConfig(node, config);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
  });
});

describe("isModelConfigured", () => {
  it("provider 和 model 都存在时返回 true", () => {
    expect(isModelConfigured({ provider: "openai", model: "gpt-4" })).toBe(true);
  });

  it("缺少 provider 时返回 false", () => {
    expect(isModelConfigured({ model: "gpt-4" })).toBe(false);
  });

  it("缺少 model 时返回 false", () => {
    expect(isModelConfigured({ provider: "openai" })).toBe(false);
  });

  it("空对象时返回 false", () => {
    expect(isModelConfigured({})).toBe(false);
  });
});

describe("formatModelString", () => {
  it("生成 provider/model 字符串", () => {
    expect(formatModelString({ provider: "openai", model: "gpt-4" })).toBe("openai/gpt-4");
  });

  it("缺少 provider 时返回 undefined", () => {
    expect(formatModelString({ model: "gpt-4" })).toBeUndefined();
  });

  it("缺少 model 时返回 undefined", () => {
    expect(formatModelString({ provider: "openai" })).toBeUndefined();
  });
});
