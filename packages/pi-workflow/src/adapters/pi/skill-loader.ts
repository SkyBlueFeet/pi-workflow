import type { ResolvedPackage } from "../../config/package-resolver.js";
import { loadPackageSkill } from "./package-resource-loader.js";

/** 已加载的技能内容。 */
export interface LoadedSkill {
  readonly name: string;
  readonly content: string;
  readonly packageAlias: string;
}

/**
 * 通过 "@packageAlias/skillName" 格式引用在已解析包中查找并加载技能。
 *
 * @param ref 技能引用字符串
 * @param resolvedPackages 已解析的包列表
 * @returns 已加载的技能，未找到时返回 undefined
 */
export function findSkill(
  ref: string,
  resolvedPackages: ResolvedPackage[],
): LoadedSkill | undefined {
  const match = ref.match(/^@([\w-]+(?:\/[\w-]+)?)\/(.+)$/);
  if (!match) return undefined;

  const packageAlias = match[1];
  const skillName = match[2];
  const pkg = resolvedPackages.find((p) => p.declaration.alias === packageAlias);
  if (!pkg) return undefined;

  const resource = loadPackageSkill(pkg, skillName);
  if (!resource) return undefined;

  return {
    name: skillName,
    content: resource.content,
    packageAlias,
  };
}

/**
 * 解析技能引用并返回技能内容文本。
 *
 * @param ref 技能引用字符串
 * @param resolvedPackages 已解析的包列表
 * @returns 技能内容文本，未找到时返回 undefined
 */
export function resolveSkillRef(
  ref: string,
  resolvedPackages: ResolvedPackage[],
): string | undefined {
  const skill = findSkill(ref, resolvedPackages);
  return skill?.content;
}
