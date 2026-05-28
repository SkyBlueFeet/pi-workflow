import type { InstalledPackageRecord, PackageDeclaration } from "./types.js";
import {
  getInstalledPackageInfo,
  installPackageWithPi,
  listInstalledPackages,
  uninstallPackageWithPi,
} from "@pi-workflow/pi-package-adapter";

/** 包安装的结果。 */
export interface InstallResult {
  readonly record: InstalledPackageRecord;
  readonly existing: boolean;
}

/**
 * 安装 PI 包。
 *
 * @param decl 包声明（别名+来源）
 * @param cwd 工作目录（用于定位 .pi-workflow 缓存）
 * @returns 安装结果
 */
export async function installPackage(decl: PackageDeclaration, cwd?: string): Promise<InstallResult> {
  const result = await installPackageWithPi(decl, cwd);
  return {
    record: result.record,
    existing: result.existing,
  };
}

/**
 * 卸载 PI 包。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 是否成功卸载
 */
export async function uninstallPackage(alias: string, cwd?: string): Promise<boolean> {
  return uninstallPackageWithPi(alias, cwd);
}

/** 已安装包的详细信息。 */
export interface PackageInfo {
  readonly record: InstalledPackageRecord;
  readonly resourceAccessAllowed: boolean;
}

/**
 * 列出当前工作目录下所有已安装的 PI 包。
 *
 * @param cwd 工作目录
 * @returns 包信息列表
 */
export function listPackages(cwd?: string): PackageInfo[] {
  return listInstalledPackages(cwd).map((info) => ({
    record: info.record,
    resourceAccessAllowed: info.resourceAccessAllowed,
  }));
}

/**
 * 获取指定别名的已安装包信息。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 * @returns 包信息，未安装时返回 undefined
 */
export function getPackageInfo(alias: string, cwd?: string): PackageInfo | undefined {
  const info = getInstalledPackageInfo(alias, cwd);
  if (!info) {
    return undefined;
  }

  return {
    record: info.record,
    resourceAccessAllowed: info.resourceAccessAllowed,
  };
}
