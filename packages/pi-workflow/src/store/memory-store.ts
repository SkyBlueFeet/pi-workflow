import type { WorkflowRunState, WorkflowRunStateSummary, WorkflowRunStore } from "./types.js";

/** 基于内存 Map 的工作流运行存储实现，适用于单进程非持久化场景。 */
export class MemoryWorkflowRunStore implements WorkflowRunStore {
  private states = new Map<string, WorkflowRunState>();

  /** 保存运行状态的深拷贝快照到内存。 */
  async saveRunState(state: WorkflowRunState): Promise<void> {
    this.states.set(state.workflowRunId, { ...state });
  }

  /** 从内存加载指定运行的完整状态。 */
  async loadRunState(workflowRunId: string): Promise<WorkflowRunState | undefined> {
    return this.states.get(workflowRunId);
  }

  /** 列出所有运行的摘要信息。 */
  async listRunStates(): Promise<WorkflowRunStateSummary[]> {
    return [...this.states.values()].map(s => ({
      workflowRunId: s.workflowRunId,
      workflowId: s.workflowId,
      status: s.status,
      updatedAt: s.updatedAt,
    }));
  }

  /** 从内存删除指定运行状态。 */
  async deleteRunState(workflowRunId: string): Promise<void> {
    this.states.delete(workflowRunId);
  }
}
