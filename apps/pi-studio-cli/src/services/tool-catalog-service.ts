/**
 * Tool 目录服务。
 *
 * 职责：
 * 1. 统一加载已注册的 tool 列表
 * 2. 提供结构化列表与详情查询
 * 3. 与宿主 callTool() 注册点对齐
 */

/** tool 目录项摘要。 */
export interface ToolCatalogEntry {
  readonly name: string;
  readonly description: string;
  readonly type: string;
  readonly source: string;
}

/** Tool 目录服务接口。 */
export interface ToolCatalogService {
  /** 获取所有可用 tool 的摘要列表。 */
  list(): Promise<ToolCatalogEntry[]>;
  /** 按名称获取单个 tool 详情。 */
  get(name: string): Promise<ToolCatalogEntry | undefined>;
}

/** Tool 目录服务骨架实现。 */
export class ToolCatalogServiceImpl implements ToolCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 packages/pi-workflow 中的 tool bridge / extension catalog 等真实数据源。
   */
  async list(): Promise<ToolCatalogEntry[]> {
    // TODO: 接入真实 tool registry / extension catalog
    return [];
  }

  async get(_name: string): Promise<ToolCatalogEntry | undefined> {
    // TODO: 接入真实 tool registry
    return undefined;
  }
}
