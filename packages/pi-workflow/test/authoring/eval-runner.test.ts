import { describe, it, expect } from "vitest";
import { evaluateWorkflowDrafts, RuleBasedWorkflowAuthoringHost } from "../../src/index.js";

describe("evaluateWorkflowDrafts", () => {
  it("验证本地规则 host 生成的 NL-to-DSL 草案", async () => {
    const result = await evaluateWorkflowDrafts(new RuleBasedWorkflowAuthoringHost(), [
      {
        id: "agent-summary",
        request: { prompt: "使用智能体分析输入并总结结果", constraints: { id: "summary-flow" } },
        expectedNodeKinds: ["manual", "agent", "return"],
      },
      {
        id: "http-tool-flow",
        request: { prompt: "先请求 API，再调用工具处理结果" },
        expectedNodeKinds: ["http", "tool"],
      },
    ]);

    expect(result.total).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.cases.every(item => item.passed)).toBe(true);
  });

  it("prompt 为空时返回失败样例", async () => {
    const result = await evaluateWorkflowDrafts(new RuleBasedWorkflowAuthoringHost(), [
      { id: "empty", request: { prompt: "" } },
    ]);

    expect(result.failed).toBe(1);
    expect(result.cases[0].errors[0]).toContain("prompt 不能为空");
  });
});
