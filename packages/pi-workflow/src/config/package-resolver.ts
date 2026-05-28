import type { PackageDeclaration } from "../packages/types.js";
import { parsePackageSource } from "../packages/types.js";
import { findInstalledPackage } from "../packages/cache.js";
import { loadManifest, type PiPackageManifest } from "../packages/manifest.js";
import { isResourceAccessAllowed, isExecutableAllowed } from "../packages/trust.js";
import type { WorkflowConfig } from "./types.js";

/** 包解析结果，包含安装状态、权限检查结果及可能的错误信息。 */
export interface ResolvedPackage {
  readonly declaration: PackageDeclaration;
  readonly installed: boolean;
  readonly rootPath?: string;
  readonly manifest?: PiPackageManifest;
  readonly resourceAccessAllowed: boolean;
  readonly executableAllowed: boolean;
  readonly error?: string;
}

/**
 * 解析配置中声明的所有包，检查安装状态、manifest 加载及权限。
 * 无 `config.packages` 时返回空数组。
 *
 * @param config 工作流配置
 * @param cwd 包查找时的当前工作目录
 * @returns 每个包的完整解析结果
 */
export function resolveDeclaredPackages(config: WorkflowConfig, cwd?: string): ResolvedPackage[] {
  if (!config.packages) return [];

  return Object.entries(config.packages).map(([alias, spec]) => {
    const source = parsePackageSource(spec);
    const declaration: PackageDeclaration = { alias, source, enabled: true };
    const installedRecord = findInstalledPackage(alias, cwd);

    if (!installedRecord) {
      return {
        declaration,
        installed: false,
        rootPath: undefined,
        resourceAccessAllowed: false,
        executableAllowed: false,
        error: `包 "${alias}" 未安装。请运行: pi-workflow pkg install ${spec}`,
      };
    }

    let manifest: PiPackageManifest | undefined;
    try {
      manifest = loadManifest(installedRecord.rootPath);
    } catch (err) {
      return {
        declaration,
        installed: true,
        rootPath: installedRecord.rootPath,
        manifest: undefined,
        resourceAccessAllowed: isResourceAccessAllowed(alias, source, cwd),
        executableAllowed: false,
        error: `包 "${alias}" manifest 解析失败: ${String(err)}`,
      };
    }

    return {
      declaration,
      installed: true,
      rootPath: installedRecord.rootPath,
      manifest,
      resourceAccessAllowed: isResourceAccessAllowed(alias, source, cwd),
      executableAllowed: isExecutableAllowed(alias, source, cwd) && installedRecord.executable,
    };
  });
}

/**
 * 解析 `@alias/resource-name` 格式的资源引用，找出对应的已解析包。
 * 格式不匹配或包不存在时返回 undefined。
 *
 * @param ref 资源引用，如 "@my-pkg/some-resource"
 * @param resolvedPackages 已解析的包列表
 * @returns 拆分后的别名、资源名及包对象，或 undefined
 */
export function resolvePackageResource(
  ref: string,
  resolvedPackages: ResolvedPackage[],
): { alias: string; resourceName: string; pkg: ResolvedPackage } | undefined {
  const match = ref.match(/^@([\w-]+(?:\/[\w-]+)?)\/(.+)$/);
  if (!match) return undefined;
  const alias = match[1];
  const resourceName = match[2];
  const pkg = resolvedPackages.find((p) => p.declaration.alias === alias);
  if (!pkg) return undefined;
  return { alias, resourceName, pkg };
}
