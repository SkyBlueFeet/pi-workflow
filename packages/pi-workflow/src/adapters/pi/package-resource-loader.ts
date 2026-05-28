import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ResolvedPackage } from "../../config/package-resolver.js";

/** 包内资源的加载结果。 */
export interface PackageResource {
  readonly kind: "skill" | "prompt" | "theme";
  readonly name: string;
  readonly filePath: string;
  readonly content: string;
}

/**
 * 从已安装的包中加载所有资源（技能、提示、主题）。
 * 仅当包已安装、有 Manifest 且获资源访问权限时才会加载。
 *
 * @param pkg 已解析的包
 * @returns 资源列表
 */
export function loadPackageResources(pkg: ResolvedPackage): PackageResource[] {
  if (!pkg.installed || !pkg.manifest) return [];
  if (!pkg.resourceAccessAllowed) return [];

  const resources: PackageResource[] = [];
  const rootPath = resolveRootPath(pkg);

  if (pkg.manifest.skills) {
    for (const skillPath of pkg.manifest.skills) {
      const absDir = resolve(rootPath, skillPath);
      const skillMdPath = resolve(absDir, "SKILL.md");
      const skillName = getResourceName(skillPath);

      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, "utf-8");
        resources.push({ kind: "skill", name: skillName, filePath: skillMdPath, content });
      } else if (existsSync(absDir)) {
        const content = readFileSync(absDir, "utf-8");
        resources.push({ kind: "skill", name: skillName, filePath: absDir, content });
      }
    }
  }

  if (pkg.manifest.prompts) {
    for (const promptPath of pkg.manifest.prompts) {
      const absPath = resolve(rootPath, promptPath);
      if (existsSync(absPath)) {
        const content = readFileSync(absPath, "utf-8");
        resources.push({ kind: "prompt", name: getResourceName(promptPath), filePath: absPath, content });
      }
    }
  }

  if (pkg.manifest.themes) {
    for (const themePath of pkg.manifest.themes) {
      const absPath = resolve(rootPath, themePath);
      if (existsSync(absPath)) {
        const content = readFileSync(absPath, "utf-8");
        resources.push({ kind: "theme", name: getResourceName(themePath), filePath: absPath, content });
      }
    }
  }

  return resources;
}

/**
 * 从包中按名称加载单个技能资源。
 *
 * @param pkg 已解析的包
 * @param skillName 技能名称
 * @returns 技能资源，未找到时返回 undefined
 */
export function loadPackageSkill(pkg: ResolvedPackage, skillName: string): PackageResource | undefined {
  if (!pkg.installed || !pkg.manifest || !pkg.resourceAccessAllowed) return undefined;
  if (!pkg.manifest.skills) return undefined;

  const rootPath = resolveRootPath(pkg);

  for (const skillPath of pkg.manifest.skills) {
    const name = getResourceName(skillPath);
    if (name !== skillName) continue;

    const absDir = resolve(rootPath, skillPath);
    const skillMdPath = resolve(absDir, "SKILL.md");

    if (existsSync(skillMdPath)) {
      const content = readFileSync(skillMdPath, "utf-8");
      return { kind: "skill", name: skillName, filePath: skillMdPath, content };
    }
    if (existsSync(absDir)) {
      const content = readFileSync(absDir, "utf-8");
      return { kind: "skill", name: skillName, filePath: absDir, content };
    }
  }

  return undefined;
}

function resolveRootPath(pkg: ResolvedPackage): string {
  if (pkg.rootPath) {
    return pkg.rootPath;
  }

  if (pkg.declaration.source.type === "file") {
    return resolve(pkg.declaration.source.path ?? "");
  }

  return "";
}

function getResourceName(resourcePath: string): string {
  const parts = resourcePath.replace(/\\/g, "/").split("/");
  const last = parts[parts.length - 1] ?? "";
  return last.replace(/\.(md|txt|json|yaml|yml|toml)$/, "");
}
