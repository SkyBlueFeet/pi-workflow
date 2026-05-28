/** PI 包的来源类型。 */
export type PackageSourceType = "npm" | "git" | "file";

/** 包来源的完整声明，类型与定位信息。 */
export interface PackageSource {
  readonly type: PackageSourceType;
  readonly spec: string;
  readonly url?: string;
  readonly ref?: string;
  readonly path?: string;
}

/** 包的声明，包含别名与来源。 */
export interface PackageDeclaration {
  readonly alias: string;
  readonly source: PackageSource;
  readonly enabled?: boolean;
}

/** 已安装包的记录信息。 */
export interface InstalledPackageRecord {
  readonly alias: string;
  readonly packageName: string;
  readonly version: string;
  readonly source: string;
  readonly rootPath: string;
  readonly integrityHash: string;
  readonly executable: boolean;
  readonly installedAt: string;
}

/** 包的信任级别。 */
export type PackageTrustLevel = "resource-only" | "allow-execute" | "deny";

/** 信任策略的单条记录。 */
export interface PackageTrustPolicyEntry {
  readonly packageName: string;
  readonly source: string;
  readonly trustLevel: PackageTrustLevel;
  readonly updatedAt: string;
}

/**
 * 将包来源字符串解析为结构化的 PackageSource 对象。
 * 支持 npm:/git:/file: 前缀，无前缀时默认视为 npm。
 *
 * @param spec 来源字符串（如 "npm:lodash"、"git:https://...#v1.0"）
 * @returns 结构化的来源对象
 */
export function parsePackageSource(spec: string): PackageSource {
  if (spec.startsWith("npm:")) {
    return { type: "npm", spec: spec.slice(4) };
  }
  if (spec.startsWith("git:")) {
    const rest = spec.slice(4);
    const hashIndex = rest.lastIndexOf("#");
    if (hashIndex >= 0) {
      return { type: "git", url: rest.slice(0, hashIndex), ref: rest.slice(hashIndex + 1), spec };
    }
    return { type: "git", url: rest, spec };
  }
  if (spec.startsWith("file:")) {
    return { type: "file", path: spec.slice(5), spec };
  }
  return { type: "npm", spec };
}

/**
 * 将结构化的 PackageSource 序列化为字符串格式。
 *
 * @param source 结构化来源对象
 * @returns 来源字符串（如 "npm:lodash"）
 */
export function packageSourceToString(source: PackageSource): string {
  switch (source.type) {
    case "npm":
      return `npm:${source.spec}`;
    case "git":
      return `git:${source.url}${source.ref ? `#${source.ref}` : ""}`;
    case "file":
      return `file:${source.path}`;
  }
}
