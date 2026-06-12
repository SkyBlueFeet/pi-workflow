/**
 * Skill 目录服务。
 *
 * 职责：
 * 1. 统一加载已注册的 skill 列表
 * 2. 提供结构化列表与详情查询
 */

/** skill 目录项摘要。 */
export interface SkillCatalogEntry {
  readonly name: string;
  readonly description: string;
  readonly source: string;
}

/** Skill 目录服务接口。 */
export interface SkillCatalogService {
  /** 获取所有可用 skill 的摘要列表。 */
  list(): Promise<SkillCatalogEntry[]>;
  /** 按名称获取单个 skill 详情。 */
  get(name: string): Promise<SkillCatalogEntry | undefined>;
}

/** Skill 目录服务骨架实现。 */
export class SkillCatalogServiceImpl implements SkillCatalogService {
  /**
   * 骨架实现：返回空列表。
   * 后续阶段接入 packages/pi-workflow/src/adapters/pi/skill-loader.ts 等真实数据源。
   */
  async list(): Promise<SkillCatalogEntry[]> {
    // TODO: 接入真实 skill loader
    return [];
  }

  async get(_name: string): Promise<SkillCatalogEntry | undefined> {
    // TODO: 接入真实 skill loader
    return undefined;
  }
}
