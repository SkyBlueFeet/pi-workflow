import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PackageSource, PackageTrustLevel, PackageTrustPolicyEntry } from "./types.js";
import { getPiWorkflowDir } from "./cache.js";

const TRUST_POLICY_FILE = "trust-policy.json";

/** 信任策略数据：条目列表与更新时间。 */
export interface TrustPolicyData {
  readonly entries: PackageTrustPolicyEntry[];
  readonly securityPermissions?: SecurityPermissionPolicyEntry[];
  readonly updatedAt: string;
}

/** 已持久化的权限授权条目，用于记录用户长期允许的运行时权限。 */
export interface SecurityPermissionPolicyEntry {
  readonly capability: string;
  readonly resource: string;
  readonly updatedAt: string;
}

/**
 * 获取信任策略文件的完整路径。
 *
 * @param cwd 工作目录
 * @returns 策略文件路径
 */
export function getTrustPolicyPath(cwd?: string): string {
  return resolve(getPiWorkflowDir(cwd), TRUST_POLICY_FILE);
}

/**
 * 加载信任策略文件，文件不存在或格式异常时返回空策略。
 *
 * @param cwd 工作目录
 * @returns 信任策略数据
 */
export function loadTrustPolicy(cwd?: string): TrustPolicyData {
  const policyPath = getTrustPolicyPath(cwd);
  if (!existsSync(policyPath)) {
    return { entries: [], securityPermissions: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(policyPath, "utf-8");
    const parsed = JSON.parse(raw) as TrustPolicyData;
    return {
      entries: parsed.entries ?? [],
      securityPermissions: parsed.securityPermissions ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { entries: [], securityPermissions: [], updatedAt: new Date().toISOString() };
  }
}

/**
 * 持久化信任策略到文件。
 *
 * @param policy 信任策略数据
 * @param cwd 工作目录
 */
export function saveTrustPolicy(policy: TrustPolicyData, cwd?: string): void {
  const policyPath = getTrustPolicyPath(cwd);
  const data: TrustPolicyData = {
    ...policy,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(policyPath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 获取指定包的当前有效信任级别。
 * 优先使用策略文件中的条目：无条目时按来源类型设定缺省值
 *（npm/file 默认 resource-only，git 默认 deny）。
 *
 * @param packageName 包名
 * @param source 来源
 * @param cwd 工作目录
 * @returns 信任级别
 */
export function getEffectiveTrustLevel(
  packageName: string,
  source: PackageSource,
  cwd?: string,
): PackageTrustLevel {
  const policy = loadTrustPolicy(cwd);
  const entry = policy.entries.find((e) => e.packageName === packageName);
  if (entry) return entry.trustLevel;

  switch (source.type) {
    case "npm":
    case "file":
      return "resource-only";
    case "git":
      return "deny";
    default:
      return "resource-only";
  }
}

/**
 * 设置（覆盖或新增）指定包的信任级别。
 *
 * @param packageName 包名
 * @param source 来源字符串
 * @param trustLevel 目标信任级别
 * @param cwd 工作目录
 */
export function setTrustLevel(
  packageName: string,
  source: string,
  trustLevel: PackageTrustLevel,
  cwd?: string,
): void {
  const policy = loadTrustPolicy(cwd);
  const existing = policy.entries.findIndex((e) => e.packageName === packageName);
  const entry: PackageTrustPolicyEntry = {
    packageName,
    source,
    trustLevel,
    updatedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    const entries = [...policy.entries];
    entries[existing] = entry;
    saveTrustPolicy({ ...policy, entries }, cwd);
  } else {
    saveTrustPolicy({ ...policy, entries: [...policy.entries, entry] }, cwd);
  }
}

/**
 * 检查包是否被允许执行。
 *
 * @param packageName 包名
 * @param source 来源
 * @param cwd 工作目录
 * @returns 是否允许执行
 */
export function isExecutableAllowed(packageName: string, source: PackageSource, cwd?: string): boolean {
  return getEffectiveTrustLevel(packageName, source, cwd) === "allow-execute";
}

/**
 * 检查包是否被允许访问资源。
 *
 * @param packageName 包名
 * @param source 来源
 * @param cwd 工作目录
 * @returns 是否允许访问资源
 */
export function isResourceAccessAllowed(packageName: string, source: PackageSource, cwd?: string): boolean {
  const level = getEffectiveTrustLevel(packageName, source, cwd);
  return level === "resource-only" || level === "allow-execute";
}
