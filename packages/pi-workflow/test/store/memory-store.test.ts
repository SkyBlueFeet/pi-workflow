import { describe, it, expect } from "vitest";
import { MemoryWorkflowRunStore } from "../../src/store/memory-store.js";
import type { WorkflowRunState } from "../../src/store/types.js";

function makeMockState(overrides?: Partial<WorkflowRunState>): WorkflowRunState {
  return {
    workflowRunId: "test-run",
    workflowId: "test",
    status: "paused",
    frames: [],
    completedNodeIds: [],
    nodeResults: {},
    sharedContext: {},
    ir: { id: "test", version: "1", title: "T", entryNodeIds: [], nodes: [], edges: [] },
    resumePolicy: "reenter-node",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("MemoryWorkflowRunStore", () => {
  it("保存和加载运行状态", async () => {
    const store = new MemoryWorkflowRunStore();
    const state = makeMockState();
    await store.saveRunState(state);
    const loaded = await store.loadRunState("test-run");
    expect(loaded).toBeDefined();
    expect(loaded!.workflowRunId).toBe("test-run");
    expect(loaded!.status).toBe("paused");
  });

  it("不存在的 runId 返回 undefined", async () => {
    const store = new MemoryWorkflowRunStore();
    const loaded = await store.loadRunState("nonexistent");
    expect(loaded).toBeUndefined();
  });

  it("列出所有运行状态摘要", async () => {
    const store = new MemoryWorkflowRunStore();
    await store.saveRunState(makeMockState({ workflowRunId: "r1" }));
    await store.saveRunState(makeMockState({ workflowRunId: "r2" }));
    const list = await store.listRunStates();
    expect(list).toHaveLength(2);
  });

  it("删除运行状态", async () => {
    const store = new MemoryWorkflowRunStore();
    await store.saveRunState(makeMockState());
    await store.deleteRunState("test-run");
    const loaded = await store.loadRunState("test-run");
    expect(loaded).toBeUndefined();
  });
});
