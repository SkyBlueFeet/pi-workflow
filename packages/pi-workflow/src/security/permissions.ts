import type { PermissionCapability, PermissionGrant } from "./types.js";

/** 高风险能力列表：文件写入、进程执行、网络请求、Extension 及 MCP 调用。 */
export const HIGH_RISK_CAPABILITIES: readonly PermissionCapability[] = [
  "fs.write",
  "process.execute",
  "network.request",
  "extension.execute",
  "mcp.use",
];

/** 中风险能力列表：文件读取、子工作流调用。 */
export const MEDIUM_RISK_CAPABILITIES: readonly PermissionCapability[] = [
  "fs.read",
  "workflow.invoke",
];

/** 全部能力集合，包含高风险与中风险能力。 */
export const ALL_CAPABILITIES: readonly PermissionCapability[] = [
  ...HIGH_RISK_CAPABILITIES,
  ...MEDIUM_RISK_CAPABILITIES,
];

/** 能力中文标签映射，用于审计日志和错误信息。 */
export const CAPABILITY_LABELS: Record<PermissionCapability, string> = {
  "fs.read": "文件读取",
  "fs.write": "文件写入",
  "network.request": "网络访问",
  "process.execute": "命令执行",
  "mcp.use": "MCP 调用",
  "extension.execute": "Extension 执行",
  "workflow.invoke": "子工作流调用",
};

/** 判断某能力是否属于高风险类别。 */
export function isHighRisk(capability: PermissionCapability): boolean {
  return HIGH_RISK_CAPABILITIES.includes(capability);
}

/** 判断某能力是否属于已知安全（非高风险）类别。 */
export function isKnownSafe(capability: PermissionCapability): boolean {
  return !isHighRisk(capability);
}

/**
 * 判断一条授权记录是否匹配指定能力及作用域。
 * scope 比较只检查 grant 中存在的键，多余的 scope 键视为匹配。
 */
export function grantMatches(
  grant: PermissionGrant,
  capability: PermissionCapability,
  scope?: Readonly<Record<string, unknown>>,
): boolean {
  if (grant.capability !== capability) return false;
  if (!grant.scope || !scope) return true;
  for (const [key, value] of Object.entries(scope)) {
    if (grant.scope[key] !== value) return false;
  }
  return true;
}

/** 在授权列表中查找匹配指定能力与作用域的第一条授权。 */
export function findGrant(
  grants: readonly PermissionGrant[],
  capability: PermissionCapability,
  scope?: Readonly<Record<string, unknown>>,
): PermissionGrant | undefined {
  return grants.find((g) => grantMatches(g, capability, scope));
}

/** 合并多组授权记录，同能力同作用域的记录去重。 */
export function mergeGrants(...sources: readonly (readonly PermissionGrant[])[]): readonly PermissionGrant[] {
  const map = new Map<string, PermissionGrant>();
  for (const source of sources) {
    for (const grant of source) {
      const key = `${grant.capability}:${JSON.stringify(grant.scope ?? {})}`;
      map.set(key, grant);
    }
  }
  return [...map.values()];
}

/**
 * 取两组授权记录的交集——lower 中的每条授权必须在 upper 中有匹配。
 * 用于实现权限降级（子集不得超出父集）。
 */
export function intersectGrants(
  upper: readonly PermissionGrant[],
  lower: readonly PermissionGrant[],
): readonly PermissionGrant[] {
  return lower.filter((lg) =>
    upper.some((ug) => grantMatches(ug, lg.capability, lg.scope)),
  );
}
