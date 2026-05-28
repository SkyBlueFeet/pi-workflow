import { describe, expect, it, vi } from "vitest";
import { adaptWorkflowTool } from "../../src/agents/workflow-tool-adapter.js";

describe("workflow tool adapter", () => {
  it("子工作流执行时透传父级 config", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: { ok: true } });
    const tool = adaptWorkflowTool({
      name: "summarize",
      description: "Summarize",
      workflow: { id: "wf", version: "1", title: "wf", entryNodeIds: [], nodes: [], edges: [] },
    }, {
      runtime: { runSubWorkflow } as any,
      config: { model: { provider: "openai", model: "gpt-4o-mini" } },
      parentRunId: "run-1",
      maxDepth: 3,
    });

    await tool.execute({ topic: "demo" });

    expect(runSubWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      { topic: "demo" },
      expect.objectContaining({
        config: { model: { provider: "openai", model: "gpt-4o-mini" } },
        parentRunId: "run-1",
        maxDepth: 3,
      }),
    );
  });

  it("未授权 workflow.invoke 时拒绝执行工作流工具", async () => {
    const runSubWorkflow = vi.fn();
    const tool = adaptWorkflowTool({
      name: "summarize",
      workflow: { id: "wf", version: "1", title: "wf", entryNodeIds: [], nodes: [], edges: [] },
    }, {
      runtime: { runSubWorkflow } as any,
      config: {
        security: {
          permissions: [],
        },
      },
      parentRunId: "run-1",
      maxDepth: 3,
    });

    const result = await tool.execute({ topic: "demo" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("未获授权");
    expect(runSubWorkflow).not.toHaveBeenCalled();
  });

  it("未授权但用户批准一次时继续执行工作流工具", async () => {
    const runSubWorkflow = vi.fn().mockResolvedValue({ finalOutput: { ok: true } });
    const tool = adaptWorkflowTool({
      name: "summarize",
      workflow: { id: "wf", version: "1", title: "wf", entryNodeIds: [], nodes: [], edges: [] },
    }, {
      runtime: { runSubWorkflow } as any,
      config: {
        security: {
          permissions: [],
        },
      },
      host: {
        requestUserInput: async () => ({ input: { approved: true } }),
      } as any,
      parentRunId: "run-1",
      maxDepth: 3,
    });

    const result = await tool.execute({ topic: "demo" });
    expect(result.isError).toBe(false);
    expect(runSubWorkflow).toHaveBeenCalled();
  });
});
