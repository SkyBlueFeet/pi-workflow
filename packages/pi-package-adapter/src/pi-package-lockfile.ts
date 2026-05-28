import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InstalledPackageRecord } from "./pi-package-adapter.js";

const PI_WORKFLOW_DIR = ".pi-workflow";
const LOCKFILE_NAME = "pi-workflow.lock";

interface LockfileData {
  readonly version: string;
  readonly packages: Record<string, InstalledPackageRecord>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function getPiWorkflowDir(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), PI_WORKFLOW_DIR);
}

function getLockfilePath(cwd?: string): string {
  return resolve(getPiWorkflowDir(cwd), LOCKFILE_NAME);
}

/**
 * 加载锁文件。文件不存在或解析失败时返回空的默认数据结构。
 */
export function loadLockfile(cwd?: string): LockfileData {
  const lockPath = getLockfilePath(cwd);
  if (!existsSync(lockPath)) {
    return { version: "1", packages: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  try {
    const raw = readFileSync(lockPath, "utf-8");
    const parsed = JSON.parse(raw) as LockfileData;
    return {
      version: parsed.version ?? "1",
      packages: parsed.packages ?? {},
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { version: "1", packages: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
}

/**
 * 将锁文件数据写入磁盘，自动创建元数据目录并更新 updatedAt 时间戳。
 */
export function saveLockfile(data: LockfileData, cwd?: string): void {
  const workflowDir = getPiWorkflowDir(cwd);
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }

  const lockPath = getLockfilePath(cwd);
  writeFileSync(lockPath, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
}

/**
 * 更新或新增锁文件中的单个包记录。
 *
 * @param alias 包别名
 * @param record 包记录
 * @param cwd 工作目录
 */
export function updatePackageInLockfile(alias: string, record: InstalledPackageRecord, cwd?: string): void {
  const lockfile = loadLockfile(cwd);
  lockfile.packages[alias] = record;
  saveLockfile(lockfile, cwd);
}

/**
 * 从锁文件中移除指定包记录。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 是否实际移除了记录
 */
export function removePackageFromLockfile(alias: string, cwd?: string): boolean {
  const lockfile = loadLockfile(cwd);
  if (!lockfile.packages[alias]) return false;
  delete lockfile.packages[alias];
  saveLockfile(lockfile, cwd);
  return true;
}
