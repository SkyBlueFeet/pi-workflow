import { describe, it, expect } from "vitest";
import {
  AuthoringFixCodes,
  WorkflowFixer,
  WorkflowLinter,
} from "../../src/index.js";

describe("WorkflowFixer", () => {
  it("会删除不可达节点，并从其他节点引用中移除它", () => {
    const linter = new WorkflowLinter();
    const fixer = new WorkflowFixer();
    const lintResult = linter.lintObject({
      id: "draft",
      version: "1.0",
      title: "Draft",
      entry: "start",
      nodes: [
        { id: "start", title: "Start", executor: { type: "workflow" }, children: ["finish"] },
        { id: "finish", title: "Finish", executor: { type: "return" }, dependsOn: ["start"] },
        { id: "orphan", title: "Orphan", executor: { type: "return" } },
      ],
    });

    const removeFixes = lintResult.suggestedFixes.filter(fix => fix.code === AuthoringFixCodes.REMOVE_UNREACHABLE_NODE);
    const result = fixer.apply(lintResult.document, removeFixes);

    expect(result.appliedFixes).toHaveLength(1);
    expect(result.skippedFixes).toHaveLength(0);
    expect(result.document.nodes.some(node => node.id === "orphan")).toBe(false);

    const start = result.document.nodes.find(node => node.id === "start");
    expect(start?.children).toEqual(["finish"]);
  });

  it("对不支持的建议类型保持跳过", () => {
    const fixer = new WorkflowFixer();
    const result = fixer.apply(
      {
        id: "draft",
        version: "1.0",
        title: "Draft",
        entry: "start",
        nodes: [{ id: "start", executor: { type: "return" } }],
      },
      [
        {
          code: "AUTH-FIX-001",
          action: "connect-node",
          description: "connect",
          nodeId: "start",
        },
      ],
    );

    expect(result.appliedFixes).toHaveLength(0);
    expect(result.skippedFixes).toHaveLength(1);
    expect(result.document.nodes).toHaveLength(1);
  });

  it("会删除空 children 的复合节点", () => {
    const fixer = new WorkflowFixer();
    const result = fixer.apply(
      {
        id: "draft",
        version: "1.0",
        title: "Draft",
        entry: "group",
        nodes: [
          { id: "group", executor: { type: "workflow" }, children: [] },
          { id: "finish", executor: { type: "return" } },
        ],
      },
      [
        {
          code: AuthoringFixCodes.REMOVE_EMPTY_COMPOSITE_NODE,
          action: "remove-node",
          description: "remove empty composite",
          nodeId: "group",
        },
      ],
    );

    expect(result.appliedFixes).toHaveLength(1);
    expect(result.document.nodes.some(node => node.id === "group")).toBe(false);
    expect(result.document.entry).toBe("finish");
  });
});
