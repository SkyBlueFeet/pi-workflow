/**
 * Agent 目录服务。
 *
 * 职责：
 * 1. 统一加载已注册的 agent 列表
 * 2. 提供结构化列表与详情查询
 * 3. 屏蔽底层 registry / resolver 差异
 */

/** agent 目录项摘要。 */
export interface AgentCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly runtimeMode: string;
  readonly skillCount: number;
  readonly toolCount: number;
}

/** Agent 目录服务接口。 */
export interface AgentCatalogService {
  /** 获取所有已注册 agent 的摘要列表。 */
  list(): Promise<AgentCatalogEntry[]>;
  /** 按 ID 获取单个 agent 详情。 */
  get(id: string): Promise<AgentCatalogEntry | undefined>;
  /** 检查 agent 是否存在。 */
  has(id: string): Promise<boolean>;
}

/** Agent 目录服务骨架实现。 */
export class AgentCatalogServiceImpl implements AgentCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 packages/pi-workflow 中的 AgentRegistry 等真实数据源。
   */
  async list(): Promise<AgentCatalogEntry[]> {
    // TODO: 接入真实 agent registry
    return [];
  }

  async get(id: string): Promise<AgentCatalogEntry | undefined> {
    // TODO: 接入真实 agent registry
    return undefined;
  }

  async has(id: string): Promise<boolean> {
    const entry = await this.get(id);
    return entry !== undefined;
  }
}

/** 从 agent registry 加载数据到目录项的预留工厂函数。 */
export function agentToCatalogEntry(_raw: unknown): AgentCatalogEntry {
  // TODO: 后续阶段实现真实映射
  throw new Error("agentToCatalogEntry 尚未实现 — 预留接口");
}
