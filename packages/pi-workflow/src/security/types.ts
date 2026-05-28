/** 权限能力枚举，涵盖文件读写、网络请求、进程执行、MCP/Extension/子工作流调用。 */
export type PermissionCapability =
  | "fs.read"
  | "fs.write"
  | "network.request"
  | "process.execute"
  | "mcp.use"
  | "extension.execute"
  | "workflow.invoke";

/** 单条权限授权，包含能力名称及可选的作用域约束。 */
export interface PermissionGrant {
  readonly capability: PermissionCapability;
  readonly scope?: Readonly<Record<string, unknown>>;
}

/** 安全默认模式：拒绝高风险 / 放行已知安全能力。 */
export type SecurityDefaultMode = "deny" | "allow-known-safe";

/** 节点级安全配置，可覆盖该节点允许的权限子集。 */
export interface NodeSecurityConfig {
  readonly permissions?: readonly PermissionGrant[];
}

/** 审计配置，控制是否启用审计及允许/拒绝事件的记录粒度。 */
export interface SecurityAuditConfig {
  readonly enabled?: boolean;
  readonly includeAllowDecisions?: boolean;
  readonly includeDenyDecisions?: boolean;
}

/** 工作流级安全策略，包含默认模式、权限列表、节点策略及审计配置。 */
export interface WorkflowSecurityConfig {
  readonly defaultMode?: SecurityDefaultMode;
  readonly permissions?: readonly PermissionGrant[];
  readonly nodes?: Record<string, NodeSecurityConfig>;
  readonly audit?: SecurityAuditConfig;
}

/** 执行者类型：工作流、智能体、工具、工作流工具、扩展。 */
export type ActorType = "workflow" | "agent" | "tool" | "workflow-tool" | "extension";

/** 权限解析后的上下文快照，记录运行 ID、执行者类型及当前生效的权限列表。 */
export interface ResolvedSecurityContext {
  readonly runId: string;
  readonly actorType: ActorType;
  readonly grants: readonly PermissionGrant[];
  readonly inheritedFrom?: string;
}

/** 安全决策事件，记录一次 allow/deny 判决的完整上下文。 */
export interface SecurityDecisionEvent {
  readonly runId: string;
  readonly nodeId?: string;
  readonly actorType: ActorType;
  readonly capability: PermissionCapability;
  readonly decision: "allow" | "deny";
  readonly reason: string;
  readonly timestamp: string;
}

/** 权限检查结果，包含是否允许及原因说明。 */
export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason: string;
}
