import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ResolvedPackage } from "../../config/package-resolver.js";

/** 扩展目录中的单条条目。 */
export interface ExtensionEntry {
  readonly name: string;
  readonly packageAlias: string;
  readonly entryPath: string;
  readonly discovered: boolean;
  readonly executable: boolean;
  readonly error?: string;
}

/**
 * 从已解析的包列表中构建扩展目录。
 * 仅处理已安装、有清单、且已获资源访问权限的包。
 *
 * @param resolvedPackages 已解析的包列表
 * @returns 扩展条目列表
 */
export function buildExtensionCatalog(resolvedPackages: ResolvedPackage[]): ExtensionEntry[] {
  const entries: ExtensionEntry[] = [];

  for (const pkg of resolvedPackages) {
    if (!pkg.installed || !pkg.manifest || !pkg.manifest.extensions) continue;
    if (!pkg.resourceAccessAllowed) continue;

    for (const extPath of pkg.manifest.extensions) {
      const name = getExtensionName(extPath);
      const absEntryPath = resolve(pkg.rootPath ?? pkg.declaration.source.path ?? "", extPath);
      const exists = existsSync(absEntryPath);

      entries.push({
        name,
        packageAlias: pkg.declaration.alias,
        entryPath: extPath,
        discovered: true,
        executable: exists && pkg.executableAllowed,
        error: !exists ? `extension 入口不存在: ${absEntryPath}` : undefined,
      });
    }
  }

  return entries;
}

/**
 * 在目录中按名称查找扩展。
 *
 * @param name 扩展名称
 * @param catalog 扩展目录
 * @returns 找到的扩展条目，未找到时返回 undefined
 */
export function findExtension(
  name: string,
  catalog: ExtensionEntry[],
): ExtensionEntry | undefined {
  return catalog.find((e) => e.name === name);
}

function getExtensionName(extPath: string): string {
  const parts = extPath.replace(/\\/g, "/").split("/");
  const last = parts[parts.length - 1] ?? "";
  return last.replace(/\.(js|mjs|cjs|ts|mts|cts)$/, "");
}
