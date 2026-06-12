/**
 * Run 目录服务。
 *
 * 职责：
 * 1. 统一加载最近的运行记录
 * 2. 提供结构化列表与详情查询
 * 3. 与 workflow runner 的可恢复 run 入口对齐
 */

/** run 目录项摘要。 */
export interface RunCatalogEntry {
  readonly runId: string;
  readonly workflowId: string;
  readonly status: "running" | "paused" | "completed" | "failed";
  readonly startedAt: string;
  readonly completedAt?: string;
}

/** Run 目录服务接口。 */
export interface RunCatalogService {
  /** 获取最近的运行记录列表。 */
  list(): Promise<RunCatalogEntry[]>;
  /** 按 runId 获取单条运行记录详情。 */
  get(runId: string): Promise<RunCatalogEntry | undefined>;
  /** 获取所有可恢复的 paused run。 */
  getResumable(): Promise<RunCatalogEntry[]>;
}

/** Run 目录服务骨架实现。 */
export class RunCatalogServiceImpl implements RunCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 runtime / workflow runner 等执行链路的数据源。
   */
  async list(): Promise<RunCatalogEntry[]> {
    // TODO: 接入真实 run store
    return [];
  }

  async get(_runId: string): Promise<RunCatalogEntry | undefined> {
    // TODO: 接入真实 run store
    return undefined;
  }

  async getResumable(): Promise<RunCatalogEntry[]> {
    const runs = await this.list();
    return runs.filter((r) => r.status === "paused");
  }
}
