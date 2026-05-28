import { describe, it, expect } from "vitest";
import { WorkflowRenderer, WorkflowLinter } from "../../src/index.js";

describe("WorkflowRenderer", () => {
  it("会输出稳定的 workflow 摘要", () => {
    const renderer = new WorkflowRenderer();
    const result = renderer.render({
      id: "summary-flow",
      version: "1.0",
      title: "Summary Flow",
      entry: "start",
      nodes: [
        { id: "start", executor: { type: "manual" } },
        { id: "finish", executor: { type: "return" }, dependsOn: ["start"] },
      ],
    });

    expect(result.summary).toContain("Workflow: Summary Flow (summary-flow)");
    expect(result.summary).toContain("Entry: start");
    expect(result.summary).toContain("Kinds: manual=1, return=1");
    expect(result.summary).toContain("- finish [return] deps=start children=-");
  });

  it("会带出诊断统计", () => {
    const linter = new WorkflowLinter();
    const renderer = new WorkflowRenderer();
    const lintResult = linter.lintObject({
      id: "draft",
      version: "1.0",
      title: "Draft",
      entry: "start",
      nodes: [
        { id: "start", executor: { type: "workflow" }, children: ["finish"] },
        { id: "finish", executor: { type: "return" } },
        { id: "orphan", executor: { type: "return" } },
      ],
    });

    const result = renderer.render(lintResult.document, lintResult.diagnostics);
    expect(result.summary).toContain("Diagnostics: errors=0, warnings=1");
  });
});
