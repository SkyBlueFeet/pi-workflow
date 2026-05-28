import { describe, it, expect } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuthoringDiagnosticCodes,
  WorkflowLinter,
  WORKFLOW_DSL_SCHEMA_URI,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("WorkflowLinter", () => {
  it("对合法对象文档返回空诊断", () => {
    const linter = new WorkflowLinter();
    const result = linter.lintObject({
      $schema: WORKFLOW_DSL_SCHEMA_URI,
      id: "ok",
      version: "1.0",
      title: "OK",
      entry: "start",
      nodes: [
        { id: "start", title: "Start", executor: { type: "manual" }, inputs: { value: { from: "literal", value: 1 } } },
        { id: "finish", title: "Finish", executor: { type: "return" }, dependsOn: ["start"] },
      ],
    });

    expect(result.diagnostics).toHaveLength(0);
    expect(result.suggestedFixes).toHaveLength(0);
  });

  it("对不可达节点输出 warning 和修复建议", () => {
    const linter = new WorkflowLinter();
    const result = linter.lintObject({
      id: "draft",
      version: "1.0",
      title: "Draft",
      entry: "start",
      nodes: [
        { id: "start", title: "Start", executor: { type: "workflow" }, children: ["finish"] },
        { id: "finish", title: "Finish", executor: { type: "return" } },
        { id: "orphan", title: "Orphan", executor: { type: "return" } },
      ],
    });

    expect(result.diagnostics.some(d => d.code === AuthoringDiagnosticCodes.UNREACHABLE_NODE && d.nodeId === "orphan")).toBe(true);
    expect(result.suggestedFixes.some(f => f.nodeId === "orphan" && f.action === "connect-node")).toBe(true);
    expect(result.suggestedFixes.some(f => f.nodeId === "orphan" && f.action === "remove-node")).toBe(true);
  });

  it("对空 children 的复合节点输出 warning 和删除建议", () => {
    const linter = new WorkflowLinter();
    const result = linter.lintObject({
      id: "draft",
      version: "1.0",
      title: "Draft",
      entry: "group",
      nodes: [
        { id: "group", executor: { type: "workflow" }, children: [] },
      ],
    });

    expect(result.diagnostics.some(d => d.code === AuthoringDiagnosticCodes.EMPTY_CHILDREN && d.nodeId === "group")).toBe(true);
    expect(result.suggestedFixes.some(f => f.code === "AUTH-FIX-003" && f.nodeId === "group")).toBe(true);
  });

  it("对缺失输入策略的 manual 节点输出 warning", () => {
    const linter = new WorkflowLinter();
    const result = linter.lintObject({
      id: "draft",
      version: "1.0",
      title: "Draft",
      entry: "collect",
      nodes: [
        { id: "collect", executor: { type: "manual" } },
      ],
    });

    expect(result.diagnostics.some(d => d.code === AuthoringDiagnosticCodes.MISSING_INPUT_POLICY && d.nodeId === "collect")).toBe(true);
  });

  it("目录 lint 会透传底层 loader 错误", () => {
    const linter = new WorkflowLinter();
    const workflowDir = resolve(__dirname, "../fixtures/invalid-schema-flow");
    const result = linter.lintDirectory(workflowDir);

    expect(result.diagnostics.some(d => d.code === "DSL-011" && d.path === "$schema")).toBe(true);
  });
});
