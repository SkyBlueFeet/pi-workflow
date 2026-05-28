import { mkdirSync } from "node:fs";
import { getPiWorkflowDir } from "../packages/cache.js";
import {
  loadTrustPolicy,
  saveTrustPolicy,
} from "../packages/trust.js";
import type { PermissionCapability } from "./types.js";

const runScopedApprovals = new Map<string, Set<string>>();

/** 构造统一的权限资源键，用于 run 级和持久化授权去重。 */
export function buildApprovalResource(
  capability: PermissionCapability,
  resource?: string,
): string {
  return `${capability}:${resource ?? "*"}`;
}

/** 判断某权限是否已被当前运行临时授权。 */
export function hasRunScopedApproval(
  runId: string | undefined,
  capability: PermissionCapability,
  resource?: string,
): boolean {
  if (!runId) {
    return false;
  }

  const runApprovals = runScopedApprovals.get(runId);
  if (!runApprovals) {
    return false;
  }

  return runApprovals.has(buildApprovalResource(capability, resource));
}

/** 为当前运行记录一次临时授权。 */
export function grantRunScopedApproval(
  runId: string,
  capability: PermissionCapability,
  resource?: string,
): void {
  const approvals = runScopedApprovals.get(runId) ?? new Set<string>();
  approvals.add(buildApprovalResource(capability, resource));
  runScopedApprovals.set(runId, approvals);
}

/** 清理某次运行的临时授权缓存。 */
export function clearRunScopedApprovals(runId: string): void {
  runScopedApprovals.delete(runId);
}

/** 判断某权限是否已被持久化授权。 */
export function hasPersistentApproval(
  capability: PermissionCapability,
  resource?: string,
  cwd?: string,
): boolean {
  const policy = loadTrustPolicy(cwd);
  const approvalKey = buildApprovalResource(capability, resource);
  return (policy.securityPermissions ?? []).some((entry) =>
    entry.capability === capability && entry.resource === approvalKey,
  );
}

/** 将权限授权持久化到 trust-policy.json。 */
export function persistApproval(
  capability: PermissionCapability,
  resource?: string,
  cwd?: string,
): void {
  const policy = loadTrustPolicy(cwd);
  const entries = [...(policy.securityPermissions ?? [])];
  const approvalKey = buildApprovalResource(capability, resource);
  const existingIndex = entries.findIndex((entry) => entry.resource === approvalKey);
  const nextEntry = {
    capability,
    resource: approvalKey,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    entries[existingIndex] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  mkdirSync(getPiWorkflowDir(cwd), { recursive: true });
  saveTrustPolicy({
    ...policy,
    securityPermissions: entries,
  }, cwd);
}
