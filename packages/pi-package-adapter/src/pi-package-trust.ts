import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PackageSource } from "./pi-package-adapter.js";

const PI_WORKFLOW_DIR = ".pi-workflow";
const TRUST_POLICY_FILE = "trust-policy.json";

interface TrustPolicyData {
  readonly entries: Array<{ packageName: string; trustLevel: "resource-only" | "allow-execute" | "deny" }>;
  readonly updatedAt: string;
}

function getTrustPolicyPath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), PI_WORKFLOW_DIR, TRUST_POLICY_FILE);
}

/**
 * 读取信任策略文件。文件不存在或解析失败时返回空策略。
 *
 * @param cwd 工作目录
 */
export function readTrustPolicy(cwd?: string): TrustPolicyData {
  const policyPath = getTrustPolicyPath(cwd);
  if (!existsSync(policyPath)) {
    return { entries: [], updatedAt: new Date().toISOString() };
  }

  try {
    const raw = readFileSync(policyPath, "utf-8");
    const parsed = JSON.parse(raw) as TrustPolicyData;
    return {
      entries: parsed.entries ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { entries: [], updatedAt: new Date().toISOString() };
  }
}

/**
 * 将信任策略数据写入磁盘，自动创建元数据目录。
 *
 * @param data 信任策略数据
 * @param cwd 工作目录
 */
export function writeTrustPolicy(data: TrustPolicyData, cwd?: string): void {
  const workflowDir = resolve(cwd ?? process.cwd(), PI_WORKFLOW_DIR);
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }

  const policyPath = getTrustPolicyPath(cwd);
  writeFileSync(policyPath, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
}

/**
 * 为指定包添加或更新信任策略条目。
 *
 * @param packageName 包名
 * @param trustLevel 信任级别
 * @param cwd 工作目录
 */
export function addTrust(packageName: string, trustLevel: "resource-only" | "allow-execute" | "deny", cwd?: string): void {
  const policy = readTrustPolicy(cwd);
  const idx = policy.entries.findIndex((e) => e.packageName === packageName);
  if (idx >= 0) {
    policy.entries[idx] = { packageName, trustLevel };
  } else {
    policy.entries.push({ packageName, trustLevel });
  }
  writeTrustPolicy(policy, cwd);
}

/**
 * 检查指定包是否被允许访问本地资源。
 * git 来源包默认拒绝，其余默认允许；信任策略可覆盖默认行为。
 *
 * @param packageName 包名（用于匹配信任策略）
 * @param source 包来源
 * @param cwd 工作目录
 */
export function isTrusted(packageName: string, source: PackageSource, cwd?: string): boolean {
  const policy = readTrustPolicy(cwd);
  const entry = policy.entries.find((item) => item.packageName === packageName);
  if (entry) {
    return entry.trustLevel === "resource-only" || entry.trustLevel === "allow-execute";
  }
  return source.type === "git" ? false : true;
}

/**
 * 读取当前工作目录的所有信任策略条目。
 *
 * @param cwd 工作目录
 * @returns 信任策略条目列表
 */
export function readAllTrustPolicies(cwd?: string): Array<{ packageName: string; trustLevel: string }> {
  return readTrustPolicy(cwd).entries;
}

/**
 * 计算包文件的完整性哈希（SHA-256 前 16 位十六进制）。
 * 递归收集包目录下所有文件内容参与哈希计算；
 * 无法读取时以根路径与当前时间戳作为降级值。
 *
 * @param rootPath 包根路径
 */
export function computeIntegrityHash(rootPath: string): string {
  const hash = createHash("sha256");

  try {
    const files = collectFiles(rootPath).sort();
    for (const filePath of files) {
      hash.update(filePath);
      hash.update(readFileSync(filePath, "utf-8"));
    }
  } catch {
    hash.update(rootPath);
    hash.update(Date.now().toString());
  }

  return hash.digest("hex").slice(0, 16);
}

/**
 * 递归收集目录下所有文件的完整路径。
 * 跳过无法访问的条目。
 */
function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    try {
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    } catch {
      continue;
    }
  }
  return files;
}
