import type {
  SecurityDecisionEvent,
  PermissionCapability,
  ActorType,
  SecurityAuditConfig,
} from "./types.js";

/** 安全审计器，记录所有安全决策事件并支持按运行/决策类型筛选查询。 */
export class SecurityAuditor {
  private events: SecurityDecisionEvent[] = [];
  private config?: SecurityAuditConfig;

  constructor(config?: SecurityAuditConfig) {
    this.config = config;
  }

  /**
   * 记录一条安全决策事件。根据审计配置过滤允许/拒绝事件。
   *
   * @param runId 运行 ID
   * @param capability 涉及的能力
   * @param decision 决策结果
   * @param reason 决策原因
   * @param options 可选的节点 ID 和执行者类型
   */
  record(
    runId: string,
    capability: PermissionCapability,
    decision: "allow" | "deny",
    reason: string,
    options?: {
      nodeId?: string;
      actorType?: ActorType;
    },
  ): void {
    const auditConfig = this.config ?? { enabled: true, includeAllowDecisions: false, includeDenyDecisions: true };

    if (!auditConfig.enabled) return;
    if (decision === "allow" && !auditConfig.includeAllowDecisions) return;
    if (decision === "deny" && !auditConfig.includeDenyDecisions) return;

    const event: SecurityDecisionEvent = {
      runId,
      nodeId: options?.nodeId,
      actorType: options?.actorType ?? "workflow",
      capability,
      decision,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
  }

  /** 返回所有审计事件的副本。 */
  getEvents(): readonly SecurityDecisionEvent[] {
    return [...this.events];
  }

  /** 按运行 ID 筛选审计事件。 */
  getEventsByRun(runId: string): readonly SecurityDecisionEvent[] {
    return this.events.filter((e) => e.runId === runId);
  }

  /** 获取所有拒绝决策事件。 */
  getDenyEvents(): readonly SecurityDecisionEvent[] {
    return this.events.filter((e) => e.decision === "deny");
  }

  /** 获取所有允许决策事件。 */
  getAllowEvents(): readonly SecurityDecisionEvent[] {
    return this.events.filter((e) => e.decision === "allow");
  }

  /** 判断是否存在任何拒绝决策事件。 */
  hasDenials(): boolean {
    return this.events.some((e) => e.decision === "deny");
  }

  /** 清空所有审计事件。 */
  clear(): void {
    this.events = [];
  }

  /** 清空指定运行 ID 的审计事件。 */
  clearRun(runId: string): void {
    this.events = this.events.filter((e) => e.runId !== runId);
  }

  /** 获取当前审计配置。 */
  get auditConfig(): SecurityAuditConfig | undefined {
    return this.config;
  }

  /** 动态更新审计配置。 */
  setAuditConfig(config: SecurityAuditConfig): void {
    this.config = config;
  }
}
