import type { AgentDefinition, CustomAgentDefinition } from "./types.js";
import type { WorkflowConfig } from "../config/types.js";

/** 独立自定义智能体注册中心接口，提供宿主级智能体目录能力。 */
export interface CustomAgentRegistry {
  list(): readonly CustomAgentDefinition[];
  get(id: string): CustomAgentDefinition | undefined;
  has(id: string): boolean;
  register(def: CustomAgentDefinition): void;
  loadFromConfig(config: WorkflowConfig): void;
}

/** Agent 定义的注册中心，支持注册、查询、枚举及从配置批量加载。 */
export class AgentRegistry implements CustomAgentRegistry {
  private agents = new Map<string, AgentDefinition>();

  /**
   * 注册一个 Agent 定义。
   *
   * @param definition Agent 定义（id 必须唯一）
   */
  register(definition: AgentDefinition | CustomAgentDefinition): void {
    this.agents.set(definition.id, definition as AgentDefinition);
  }

  /**
   * 根据 ID 获取 Agent 定义。
   *
   * @param id Agent 标识
   * @returns Agent 定义，未注册时返回 undefined
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /** 返回所有已注册的 Agent 定义列表。 */
  list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * 检查指定 ID 是否已注册。
   *
   * @param id Agent 标识
   * @returns 是否已注册
   */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /** 清空所有已注册的 Agent 定义。 */
  clear(): void {
    this.agents.clear();
  }

  /**
   * 移除指定 ID 的 Agent 定义。
   *
   * @param id Agent 标识
   * @returns 是否存在并已删除
   */
  remove(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * 从 WorkflowConfig 的 agents 配置批量加载 Agent 定义。
   * 配置来源被提升为宿主级独立智能体目录，而非仅供 workflow 使用的配置表。
   *
   * @param config 工作流配置对象
   */
  loadFromConfig(config: WorkflowConfig): void {
    if (!config.agents) return;
    for (const [id, agentDef] of Object.entries(config.agents)) {
      this.register({ ...agentDef, id });
    }
  }
}

/**
 * 从 WorkflowConfig 创建并初始化自定义智能体注册中心。
 *
 * @param config 工作流配置
 * @returns 已加载配置的注册中心
 */
export function createRegistryFromConfig(config: WorkflowConfig): AgentRegistry {
  const registry = new AgentRegistry();
  registry.loadFromConfig(config);
  return registry;
}
