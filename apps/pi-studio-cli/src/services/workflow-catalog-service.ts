/**
 * Workflow 目录服务。
 *
 * 职责：
 * 1. 统一加载已注册的 workflow 列表
 * 2. 提供结构化列表与详情查询
 * 3. 屏蔽底层 registry / loader / store 差异
 */

/** workflow 目录项摘要。 */
export interface WorkflowCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly nodeCount: number;
}

/** Workflow 目录服务接口。 */
export interface WorkflowCatalogService {
  /** 获取所有已注册 workflow 的摘要列表。 */
  list(): Promise<WorkflowCatalogEntry[]>;
  /** 按 ID 获取单个 workflow 详情。 */
  get(id: string): Promise<WorkflowCatalogEntry | undefined>;
  /** 检查 workflow 是否存在。 */
  has(id: string): Promise<boolean>;
}

/** Workflow 目录服务骨架实现。 */
export class WorkflowCatalogServiceImpl implements WorkflowCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 packages/pi-workflow 中的 registry、loader 等真实数据源。
   */
  async list(): Promise<WorkflowCatalogEntry[]> {
    // TODO: 接入真实 workflow registry
    return [];
  }

  async get(_id: string): Promise<WorkflowCatalogEntry | undefined> {
    // TODO: 接入真实 workflow registry
    return undefined;
  }

  async has(id: string): Promise<boolean> {
    const entry = await this.get(id);
    return entry !== undefined;
  }
}
