import type {
  PermissionGrant,
  PermissionCapability,
  WorkflowSecurityConfig,
} from "./types.js";
import { isHighRisk, grantMatches, intersectGrants } from "./permissions.js";

/** 策略决策结果，包含是否放行、匹配到的授权记录及原因。 */
export interface PolicyDecision {
  readonly allowed: boolean;
  readonly matchedGrant?: PermissionGrant;
  readonly reason: string;
}

/**
 * 评估某能力在当前安全配置下是否被允许。
 * 高风险能力需显式授权；已知安全能力在 `allow-known-safe` 模式下自动放行。
 *
 * @param config 安全配置
 * @param capability 待评估的能力
 * @param scope 可选的作用域约束
 * @returns 决策结果
 */
export function evaluateCapability(
  config: WorkflowSecurityConfig | undefined,
  capability: PermissionCapability,
  scope?: Readonly<Record<string, unknown>>,
): PolicyDecision {
  if (!config) {
    if (isHighRisk(capability)) {
      return { allowed: false, reason: "默认安全策略：高风险能力未显式授权" };
    }
    return { allowed: true, reason: "默认安全策略：无安全配置，低风险能力放行" };
  }

  const mode = config.defaultMode ?? "deny";

  if (config.permissions) {
    const matched = config.permissions.find((g) => grantMatches(g, capability, scope));
    if (matched) {
      return { allowed: true, matchedGrant: matched, reason: `权限已授权: ${capability}` };
    }
  }

  if (mode === "allow-known-safe" && !isHighRisk(capability)) {
    return { allowed: true, reason: `已知安全能力放行: ${capability}` };
  }

  return { allowed: false, reason: `未授权: ${capability}，请在 security.permissions 中声明` };
}

/**
 * 合并父级与子级安全策略——子级策略只能取父级已有权限的交集。
 * 防止子工作流/子模块提升权限。
 *
 * @param parent 父级安全配置
 * @param child 子级安全配置
 * @returns 合并后的安全配置，权限取交集
 */
export function mergePolicies(
  parent: WorkflowSecurityConfig | undefined,
  child: WorkflowSecurityConfig | undefined,
): WorkflowSecurityConfig {
  const parentPerms = parent?.permissions ?? [];
  const childPerms = child?.permissions ?? [];

  if (parentPerms.length === 0 && childPerms.length > 0) {
    return {
      defaultMode: parent?.defaultMode ?? child?.defaultMode ?? "deny",
      permissions: childPerms,
      audit: child?.audit ?? parent?.audit,
    };
  }

  const intersected = childPerms.filter((cp) =>
    parentPerms.some((pp) => grantMatches(pp, cp.capability, cp.scope)),
  );

  return {
    defaultMode: parent?.defaultMode ?? child?.defaultMode ?? "deny",
    permissions: intersected,
    audit: child?.audit ?? parent?.audit,
  };
}

/** 返回默认安全配置：拒绝模式、空权限、仅审计拒绝事件。 */
export function defaultSecurityConfig(): WorkflowSecurityConfig {
  return {
    defaultMode: "deny",
    permissions: [],
    audit: {
      enabled: true,
      includeAllowDecisions: false,
      includeDenyDecisions: true,
    },
  };
}

/**
 * 基于父级安全配置收缩为一个更小的权限子集，禁止局部配置静默提权。
 * 当父级未声明任何权限时，局部声明会被收敛为空集合。
 */
export function restrictSecurityConfig(
  config: WorkflowSecurityConfig | undefined,
  scopedPermissions?: readonly PermissionGrant[],
): WorkflowSecurityConfig | undefined {
  if (!scopedPermissions || scopedPermissions.length === 0) {
    return config;
  }

  const parent = config ?? defaultSecurityConfig();
  const parentPermissions = parent.permissions ?? [];

  return {
    ...parent,
    permissions: intersectGrants(parentPermissions, scopedPermissions),
  };
}

/**
 * 快捷检查某能力是否被允许，仅返回布尔值。
 * 内部委托 evaluateCapability。
 */
export function isCapabilityAllowed(
  config: WorkflowSecurityConfig | undefined,
  capability: PermissionCapability,
  scope?: Readonly<Record<string, unknown>>,
): boolean {
  return evaluateCapability(config, capability, scope).allowed;
}
