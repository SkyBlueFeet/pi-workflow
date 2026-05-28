import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WorkflowRunState, WorkflowRunStateSummary, WorkflowRunStore } from "./types.js";

/** 基于 JSON 文件的持久化工作流运行存储，每次写入时序列化到磁盘。 */
export class FileWorkflowRunStore implements WorkflowRunStore {
  private dir: string;

  /**
   * @param baseDir 存储目录，默认为 `{cwd}/.pi-workflow/runs`
   */
  constructor(baseDir?: string) {
    this.dir = baseDir ?? resolve(process.cwd(), ".pi-workflow", "runs");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  /** 将运行状态序列化为 JSON 文件写入磁盘。 */
  async saveRunState(state: WorkflowRunState): Promise<void> {
    const path = join(this.dir, `${state.workflowRunId}.json`);
    writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
  }

  /** 从 JSON 文件读取运行状态，文件不存在时返回 undefined，文件损坏时抛出。 */
  async loadRunState(workflowRunId: string): Promise<WorkflowRunState | undefined> {
    const path = join(this.dir, `${workflowRunId}.json`);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as WorkflowRunState;
    } catch {
      throw new Error(`无法解析运行状态文件: ${path}（文件可能已损坏）`);
    }
  }

  /** 列出存储目录中所有有效的运行摘要，跳过无法解析的损坏文件。 */
  async listRunStates(): Promise<WorkflowRunStateSummary[]> {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const path = join(this.dir, f);
        try {
          const raw = readFileSync(path, "utf-8");
          const s = JSON.parse(raw) as WorkflowRunState;
          return {
            workflowRunId: s.workflowRunId,
            workflowId: s.workflowId,
            status: s.status,
            updatedAt: s.updatedAt,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is WorkflowRunStateSummary => s !== null);
  }

  /** 删除指定运行的状态文件。 */
  async deleteRunState(workflowRunId: string): Promise<void> {
    const path = join(this.dir, `${workflowRunId}.json`);
    if (existsSync(path)) unlinkSync(path);
  }
}
