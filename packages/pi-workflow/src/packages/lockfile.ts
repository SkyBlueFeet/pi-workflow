import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InstalledPackageRecord } from "./types.js";
import { getPiWorkflowDir } from "./cache.js";

/** Lockfile 数据结构，包含版本号与所有已安装包记录。 */
export interface LockfileData {
  readonly version: string;
  readonly packages: Record<string, InstalledPackageRecord>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const LOCKFILE_NAME = "pi-workflow.lock";

/**
 * 获取 lockfile 的完整路径。
 *
 * @param cwd 工作目录
 * @returns lockfile 路径
 */
export function getLockfilePath(cwd?: string): string {
  return resolve(getPiWorkflowDir(cwd), LOCKFILE_NAME);
}

/**
 * 加载 lockfile，文件不存在或格式异常时返回空数据结构。
 *
 * @param cwd 工作目录
 * @returns lockfile 数据
 */
export function loadLockfile(cwd?: string): LockfileData {
  const lockPath = getLockfilePath(cwd);
  if (!existsSync(lockPath)) {
    return {
      version: "1",
      packages: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
    return {
      version: "1",
      packages: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * 持久化 lockfile 到磁盘。
 *
 * @param data lockfile 数据
 * @param cwd 工作目录
 */
export function saveLockfile(data: LockfileData, cwd?: string): void {
  const lockPath = getLockfilePath(cwd);
  const lockfile: LockfileData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(lockPath, JSON.stringify(lockfile, null, 2), "utf-8");
}
