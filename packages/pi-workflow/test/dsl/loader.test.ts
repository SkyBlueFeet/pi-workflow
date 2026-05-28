import { describe, it, expect } from "vitest";
import { loadFromObject } from "../../src/dsl/loader.js";
import { WORKFLOW_DSL_SCHEMA_URI } from "../../src/dsl/schema.js";

describe("loadFromObject", () => {
  it("加载合法的 DSL 文档时不应产生错误诊断", () => {
    const result = loadFromObject({
      $schema: WORKFLOW_DSL_SCHEMA_URI,
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [{ id: "root", executor: { type: "return" }, inputs: { v: { from: "literal", value: 42 } } }],
    });
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
  });

  it("不支持的 $schema 时输出 DSL-011 诊断", () => {
    const result = loadFromObject({
      $schema: "urn:pi-workflow:dsl:legacy",
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [{ id: "root", executor: { type: "return" } }],
    } as Record<string, unknown>);
    expect(result.diagnostics.some(d => d.code === "DSL-011" && d.path === "$schema")).toBe(true);
  });

  it("缺失 id 时输出 error 诊断", () => {
    const result = loadFromObject({
      version: "1", title: "Test", entry: "root",
      nodes: [{ id: "root", executor: { type: "return" } }],
    } as Record<string, unknown>);
    expect(result.diagnostics.some(d => d.code === "DSL-001" && d.severity === "error")).toBe(true);
  });

  it("缺失 version 时输出 error 诊断", () => {
    const result = loadFromObject({
      id: "test", title: "Test", entry: "root",
      nodes: [{ id: "root", executor: { type: "return" } }],
    } as Record<string, unknown>);
    expect(result.diagnostics.some(d => d.code === "DSL-001")).toBe(true);
  });

  it("缺失 title 时输出 error 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", entry: "root",
      nodes: [{ id: "root", executor: { type: "return" } }],
    } as Record<string, unknown>);
    expect(result.diagnostics.some(d => d.code === "DSL-001")).toBe(true);
  });

  it("缺失 entry 时输出 error 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test",
      nodes: [{ id: "root", executor: { type: "return" } }],
    } as Record<string, unknown>);
    expect(result.diagnostics.some(d => d.code === "DSL-001")).toBe(true);
  });

  it("空的 nodes 数组输出 error 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "root", nodes: [],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-001")).toBe(true);
  });

  it("重复的节点 id 输出 DSL-002 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", executor: { type: "return" } },
        { id: "root", executor: { type: "return" } },
      ],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-002")).toBe(true);
  });

  it("entry 引用了不存在的节点时输出 DSL-005 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "missing",
      nodes: [{ id: "root", executor: { type: "return" } }],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-005")).toBe(true);
  });

  it("dependsOn 引用了不存在的节点时输出 DSL-004 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [
        { id: "a", executor: { type: "manual" } },
        { id: "b", executor: { type: "return" }, dependsOn: ["nonexistent"] },
      ],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-004")).toBe(true);
  });

  it("children 引用了不存在的节点时输出 DSL-008 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "root",
      nodes: [
        { id: "root", executor: { type: "workflow" }, children: ["missing"] },
      ],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-008")).toBe(true);
  });

  it("node.output ValueRef 引用了不存在的节点时输出 DSL-003 诊断", () => {
    const result = loadFromObject({
      id: "test", version: "1", title: "Test", entry: "a",
      nodes: [
        { id: "a", executor: { type: "manual" }, inputs: { data: { from: "node.output", nodeId: "ghost" } } },
      ],
    });
    expect(result.diagnostics.some(d => d.code === "DSL-003")).toBe(true);
  });
});
