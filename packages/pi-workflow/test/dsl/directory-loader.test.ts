import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFromDirectory } from "../../src/dsl/directory-loader.js";
import { dslToIr } from "../../src/dsl/mapper.js";
import { WORKFLOW_DSL_SCHEMA_URI } from "../../src/dsl/schema.js";
import { WorkflowRuntime, ExecutorRegistry } from "../../src/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures/dir-flow");

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("loadFromDirectory", () => {
  it("从目录加载 workflow 并正确合并节点", () => {
    const result = loadFromDirectory(fixturesDir);
    const errors = result.diagnostics.filter(d => d.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.document.$schema).toBe(WORKFLOW_DSL_SCHEMA_URI);
    expect(result.document.id).toBe("dir-flow");
    expect(result.document.nodes).toHaveLength(2);
    expect(result.document.nodes.find(n => n.id === "start")).toBeDefined();
    expect(result.document.nodes.find(n => n.id === "finish")).toBeDefined();
    expect(result.resolvedFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("加载后的文档可通过 mapper 转换为 IR", () => {
    const { document, diagnostics } = loadFromDirectory(fixturesDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(document);
    expect(ir.id).toBe("dir-flow");
    expect(ir.nodes).toHaveLength(2);
    expect(ir.entryNodeIds).toContain("start");
  });

  it("转换后的 IR 可被 runtime 执行", async () => {
    const { document, diagnostics } = loadFromDirectory(fixturesDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.completed");
    expect(events.filter(e => e === "node.completed").length).toBe(2);
  });

  it("不存在的目录返回错误诊断", () => {
    const result = loadFromDirectory("/nonexistent/path");
    expect(result.diagnostics.some(d => d.code === "DIR-001")).toBe(true);
  });
});

describe("loadFromDirectory - promptFile", () => {
  const promptFixturesDir = resolve(__dirname, "../fixtures/dir-flow-with-prompt");

  it("加载包含 promptFile 的 workflow", () => {
    const { document, diagnostics, resolvedFiles } = loadFromDirectory(promptFixturesDir);
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors).toHaveLength(0);

    const agentNode = document.nodes.find(n => n.id === "agent-step");
    expect(agentNode).toBeDefined();

    const inputs = agentNode!.inputs as Record<string, unknown>;
    expect(inputs["system_prompt"]).toContain("helpful assistant");
    expect(inputs["system_prompt"]).toContain("Chinese");
    expect(resolvedFiles.some(f => f.includes("prompts") && f.includes("system.md"))).toBe(true);
  });
});

describe("loadFromDirectory - nested sub-workflow", () => {
  const nestedFixturesDir = resolve(__dirname, "../fixtures/nested-flow");

  it("加载嵌套子工作流并递归合并节点", () => {
    const { document, diagnostics } = loadFromDirectory(nestedFixturesDir);
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors).toHaveLength(0);

    expect(document.nodes.length).toBeGreaterThanOrEqual(4);
    const innerProcess = document.nodes.find(n => n.id === "inner-workflow.process");
    expect(innerProcess).toBeDefined();
    expect(innerProcess!.dependsOn).toContain("start");
  });

  it("嵌套子工作流可转换为 IR 并执行", async () => {
    const { document, diagnostics } = loadFromDirectory(nestedFixturesDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.completed");
  });
});

describe("loadFromDirectory - complex node directory", () => {
  const complexFixturesDir = resolve(__dirname, "../fixtures/complex-node-flow");

  it("加载目录类型节点并解析 promptFile", () => {
    const { document, diagnostics, resolvedFiles } = loadFromDirectory(complexFixturesDir);
    const errors = diagnostics.filter(d => d.severity === "error");
    expect(errors).toHaveLength(0);

    const promptNode = document.nodes.find(n => n.id === "step-with-prompt");
    expect(promptNode).toBeDefined();

    const inputs = promptNode!.inputs as Record<string, unknown>;
    expect(inputs["system_prompt"]).toContain("complex node directory");
    expect(resolvedFiles.some(f => f.includes("prompts") && f.includes("system.md"))).toBe(true);
  });

  it("目录节点 workflow 可执行", async () => {
    const { document, diagnostics } = loadFromDirectory(complexFixturesDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(document);
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.completed");
  });
});

describe("loadFromDirectory - minimal defaults", () => {
  const minimalDefaultsDir = resolve(__dirname, "../fixtures/minimal-default-flow");

  it("根 flow 可省略 title/version/entry，并由 defaults 补齐节点设置", () => {
    const { document, diagnostics } = loadFromDirectory(minimalDefaultsDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    expect(document.version).toBe("1.0");
    expect(document.title).toBe("minimal-default-flow");
    expect(document.entry).toBe("collect");

    const collect = document.nodes.find(n => n.id === "collect");
    expect(collect?.executor.type).toBe("manual");
    expect(collect?.control?.timeoutMs).toBe(5000);
    expect(collect?.control?.retry?.maxAttempts).toBe(2);
    expect(collect?.missingInput?.mode).toBe("fail");
  });
});

describe("loadFromDirectory - nested defaults inheritance", () => {
  const nestedDefaultsDir = resolve(__dirname, "../fixtures/nested-default-flow");

  it("子工作流继承父级设置并允许覆盖策略字段", () => {
    const { document, diagnostics } = loadFromDirectory(nestedDefaultsDir);
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const analyze = document.nodes.find(n => n.id === "review.analyze");
    const finish = document.nodes.find(n => n.id === "review.finish");

    expect(analyze?.executor.type).toBe("manual");
    expect(analyze?.executor.config).toEqual({ source: "root" });
    expect(analyze?.control?.timeoutMs).toBe(3000);
    expect(analyze?.control?.retry?.maxAttempts).toBe(4);
    expect(analyze?.control?.retry?.backoff).toBe("exponential");
    expect(analyze?.missingInput?.mode).toBe("fail");

    expect(finish?.executor.type).toBe("return");
    expect(finish?.executor.config).toEqual({ source: "child" });
    expect(finish?.control?.timeoutMs).toBe(3000);
    expect(finish?.control?.retry?.maxAttempts).toBe(4);
  });
});

describe("loadFromDirectory - failure boundaries", () => {
  const ambiguousEntryDir = resolve(__dirname, "../fixtures/ambiguous-entry-flow");
  const invalidSchemaDir = resolve(__dirname, "../fixtures/invalid-schema-flow");
  const missingExecutorDir = resolve(__dirname, "../fixtures/missing-executor-flow");

  it("entry 缺失且存在多个候选入口时输出结构化错误", () => {
    const { diagnostics } = loadFromDirectory(ambiguousEntryDir);
    expect(diagnostics.some(d => d.code === "DIR-006" && d.severity === "error")).toBe(true);
  });

  it("声明了不支持的 $schema 时输出结构化错误", () => {
    const { diagnostics } = loadFromDirectory(invalidSchemaDir);
    expect(diagnostics.some(d => d.code === "DSL-011" && d.path === "$schema")).toBe(true);
  });

  it("节点未显式提供 executor 且没有 defaults 可继承时保持错误", () => {
    const { diagnostics } = loadFromDirectory(missingExecutorDir);
    expect(diagnostics.some(d => d.code === "DSL-010" && d.severity === "error")).toBe(true);
  });
});
