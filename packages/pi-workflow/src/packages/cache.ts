import { mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { InstalledPackageRecord } from "./types.js";
import { loadLockfile, saveLockfile } from "./lockfile.js";

const PI_WORKFLOW_DIR = ".pi-workflow";
const PACKAGES_DIR = "packages";

/**
 * 获取 .pi-workflow 元数据目录路径。
 *
 * @param cwd 工作目录
 * @returns 元数据目录路径
 */
export function getPiWorkflowDir(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), PI_WORKFLOW_DIR);
}

/**
 * 获取包缓存目录路径（.pi-workflow/packages）。
 *
 * @param cwd 工作目录
 * @returns 缓存目录路径
 */
export function getCacheDir(cwd?: string): string {
  return resolve(getPiWorkflowDir(cwd), PACKAGES_DIR);
}

/**
 * 确保缓存目录存在并返回其路径。
 *
 * @param cwd 工作目录
 * @returns 缓存目录路径
 */
export function ensureCacheDir(cwd?: string): string {
  const dir = getCacheDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 获取指定别名的包根目录路径。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 包根目录路径
 */
export function getPackageRoot(alias: string, cwd?: string): string {
  return resolve(getCacheDir(cwd), alias);
}

/**
 * 在 lockfile 中查找已安装包记录。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 包记录，未安装时返回 undefined
 */
export function findInstalledPackage(alias: string, cwd?: string): InstalledPackageRecord | undefined {
  const records = listInstalledPackages(cwd);
  return records.find((r) => r.alias === alias);
}

/**
 * 从 lockfile 中列出所有已安装包。
 *
 * @param cwd 工作目录
 * @returns 已安装包记录列表
 */
export function listInstalledPackages(cwd?: string): InstalledPackageRecord[] {
  const lock = loadLockfile(cwd);
  return Object.values(lock.packages);
}

/**
 * 从缓存和 lockfile 中移除指定包。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 是否存在并已移除
 */
export function removePackage(alias: string, cwd?: string): boolean {
  const cacheDir = getCacheDir(cwd);
  const pkgDir = resolve(cacheDir, alias);
  if (!existsSync(pkgDir)) return false;

  const lock = loadLockfile(cwd);
  if (lock.packages[alias]) {
    delete lock.packages[alias];
    saveLockfile(lock, cwd);
  }

  rmSync(pkgDir, { recursive: true, force: true });

  return true;
}
