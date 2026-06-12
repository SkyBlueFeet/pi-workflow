/**
 * Resource 目录服务。
 *
 * 职责：
 * 1. 统一加载已注册的 resource 列表
 * 2. 提供结构化列表与详情查询
 */

/** resource 目录项摘要。 */
export interface ResourceCatalogEntry {
  readonly name: string;
  readonly description: string;
  readonly type: string;
  readonly source: string;
}

/** Resource 目录服务接口。 */
export interface ResourceCatalogService {
  /** 获取所有可用 resource 的摘要列表。 */
  list(): Promise<ResourceCatalogEntry[]>;
  /** 按名称获取单个 resource 详情。 */
  get(name: string): Promise<ResourceCatalogEntry | undefined>;
}

/** Resource 目录服务骨架实现。 */
export class ResourceCatalogServiceImpl implements ResourceCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 packages/pi-workflow/src/adapters/pi/package-resource-loader.ts 等真实数据源。
   */
  async list(): Promise<ResourceCatalogEntry[]> {
    // TODO: 接入真实 resource loader
    return [];
  }

  async get(_name: string): Promise<ResourceCatalogEntry | undefined> {
    // TODO: 接入真实 resource loader
    return undefined;
  }
}
