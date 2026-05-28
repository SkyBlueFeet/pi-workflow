import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  importWorkflowDefine,
  importWorkflowDefineToIr,
  WorkflowDefineDiagnosticCodes,
  loadFromObject,
  WorkflowRuntime,
  ExecutorRegistry,
  ManualExecutor,
  ReturnExecutor,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures/workflow-define");

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), "utf-8")) as Record<string, unknown>;
}

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

describe("importWorkflowDefine", () => {
  it("最小 WorkflowDefine fixture 可导入 DSL 并执行", async () => {
    const result = importWorkflowDefine(readFixture("minimal.workflowdefine.json"));
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const loadResult = loadFromObject(result.document as unknown as Record<string, unknown>);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const { ir } = importWorkflowDefineToIr(readFixture("minimal.workflowdefine.json"));
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(result.document.entry).toBe("collect");
    expect(events).toContain("workflow.completed");
  });

  it("复杂 WorkflowDefine fixture 输出稳定 diagnostics 并保留可映射节点", async () => {
    const result = importWorkflowDefine(readFixture("complex.workflowdefine.json"));
    expect(result.diagnostics.some(d => d.code === WorkflowDefineDiagnosticCodes.UNSUPPORTED_STEP_TYPE)).toBe(true);
    expect(result.diagnostics.some(d => d.code === WorkflowDefineDiagnosticCodes.UNSUPPORTED_FIELD)).toBe(true);
    expect(result.document.nodes.find(node => node.id === "review-flow.analyze")).toBeDefined();
    expect(result.document.nodes.find(node => node.id === "review-flow.complete")).toBeDefined();

    const loadResult = loadFromObject(result.document as unknown as Record<string, unknown>);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const { ir } = importWorkflowDefineToIr(readFixture("complex.workflowdefine.json"));
    const runtime = createRuntime();
    const events: string[] = [];

    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }

    expect(events).toContain("workflow.completed");
  });
});
