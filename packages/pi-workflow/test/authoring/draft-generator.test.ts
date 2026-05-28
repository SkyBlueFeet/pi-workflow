import { describe, it, expect } from "vitest";
import {
  WorkflowDraftGenerator,
  WorkflowAuthoringHost,
  WorkflowDraftRequest,
  WorkflowDraftResult,
  WorkflowAuthoringHostEvent,
} from "../../src/index.js";

class MockAuthoringHost implements WorkflowAuthoringHost {
  async *generateDraft(request: WorkflowDraftRequest): AsyncGenerator<WorkflowHostEvent, WorkflowDraftResult> {
    yield { type: "generating", message: "Generating draft..." };

    return {
      document: {
        id: "draft",
        version: "1.0",
        title: "Generated Draft",
        entry: "start",
        nodes: [
          { id: "start", executor: { type: "manual" }, inputs: { value: { from: "literal", value: 1 } } },
          { id: "finish", executor: { type: "return" }, dependsOn: ["start"] },
        ],
      },
      diagnostics: [],
    };
  }
}

class FailingAuthoringHost implements WorkflowAuthoringHost {
  async *generateDraft(_request: WorkflowDraftRequest): AsyncGenerator<WorkflowHostEvent, WorkflowDraftResult> {
    yield { type: "error", message: "Host unavailable" };
    throw new Error("Host unavailable");
  }
}

describe("WorkflowDraftGenerator", () => {
  it("使用 mock host 生成合法 draft", async () => {
    const generator = new WorkflowDraftGenerator(new MockAuthoringHost());
    const result = await generator.generate({
      prompt: "创建一个包含手动输入和返回节点的工作流",
    });

    expect(result.document.id).toBe("draft");
    expect(result.document.nodes).toHaveLength(2);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("host 生成出错时抛出异常", async () => {
    const generator = new WorkflowDraftGenerator(new FailingAuthoringHost());

    await expect(generator.generate({
      prompt: "测试失败场景",
    })).rejects.toThrow("Host unavailable");
  });
});
