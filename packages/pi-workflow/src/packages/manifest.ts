import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** PI 包的清单内容，对应 package.json 的 pi 字段。 */
export interface PiPackageManifest {
  readonly extensions?: readonly string[];
  readonly skills?: readonly string[];
  readonly prompts?: readonly string[];
  readonly themes?: readonly string[];
  readonly config?: Record<string, unknown>;
  readonly image?: string;
}

/** 清单校验过程中的单条错误。 */
export interface ManifestValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * 加载并校验 PI 包的 package.json 清单。
 * 校验 pi 字段内的 extensions/skills/prompts/themes 路径是否存在。
 *
 * @param packageRoot 包根目录
 * @returns 解析后的清单
 * @throws ManifestError 当 package.json 不存在、格式无效或路径缺失时抛出
 */
export function loadManifest(packageRoot: string): PiPackageManifest {
  const pkgJsonPath = resolve(packageRoot, "package.json");
  if (!existsSync(pkgJsonPath)) {
    throw new ManifestError([
      { field: "package.json", message: `package.json 不存在于: ${packageRoot}` },
    ]);
  }

  let pkgJson: Record<string, unknown>;
  try {
    const raw = readFileSync(pkgJsonPath, "utf-8");
    pkgJson = JSON.parse(raw);
  } catch (err) {
    throw new ManifestError([
      { field: "package.json", message: `解析 package.json 失败: ${String(err)}` },
    ]);
  }

  const piField = pkgJson["pi"];
  if (!piField || typeof piField !== "object") {
    throw new ManifestError([
      { field: "pi", message: "package.json 缺少 pi 字段或 pi 字段不是对象类型" },
    ]);
  }

  const pi = piField as Record<string, unknown>;
  const errors: ManifestValidationError[] = [];

  const extensions = validateStringArray(pi, "extensions", errors);
  const skills = validateStringArray(pi, "skills", errors);
  const prompts = validateStringArray(pi, "prompts", errors);
  const themes = validateStringArray(pi, "themes", errors);

  for (const ext of extensions ?? []) {
    const absPath = resolve(packageRoot, ext);
    if (!existsSync(absPath)) {
      errors.push({ field: `extensions.${ext}`, message: `extension 入口路径不存在: ${absPath}` });
    }
  }

  for (const skill of skills ?? []) {
    const skillDir = resolve(packageRoot, skill, "SKILL.md");
    if (!existsSync(skillDir)) {
      const altPath = resolve(packageRoot, skill);
      if (!existsSync(altPath)) {
        errors.push({ field: `skills.${skill}`, message: `skill 目录不存在: ${skill}` });
      }
    }
  }

  for (const prompt of prompts ?? []) {
    const promptPath = resolve(packageRoot, prompt);
    if (!existsSync(promptPath)) {
      errors.push({ field: `prompts.${prompt}`, message: `prompt 文件不存在: ${promptPath}` });
    }
  }

  for (const theme of themes ?? []) {
    const themePath = resolve(packageRoot, theme);
    if (!existsSync(themePath)) {
      errors.push({ field: `themes.${theme}`, message: `theme 文件不存在: ${themePath}` });
    }
  }

  if (errors.length > 0) {
    throw new ManifestError(errors);
  }

  const config = typeof pi["config"] === "object" && pi["config"] !== null
    ? (pi["config"] as Record<string, unknown>)
    : undefined;

  const image = typeof pi["image"] === "string" ? pi["image"] : undefined;

  return {
    extensions,
    skills,
    prompts,
    themes,
    config,
    image,
  };
}

function validateStringArray(
  obj: Record<string, unknown>,
  field: string,
  errors: ManifestValidationError[],
): readonly string[] | undefined {
  const val = obj[field];
  if (val == null) return undefined;
  if (!Array.isArray(val)) {
    errors.push({ field, message: `${field} 必须是字符串数组` });
    return undefined;
  }
  const strings = val.filter((v): v is string => typeof v === "string");
  if (strings.length !== val.length) {
    errors.push({ field, message: `${field} 中所有元素必须是字符串` });
  }
  return strings;
}

/** PI 包清单校验错误的封装，包含所有校验失败的字段详情。 */
export class ManifestError extends Error {
  readonly errors: ManifestValidationError[];
  constructor(errors: ManifestValidationError[]) {
    const msg = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    super(`PI 包 Manifest 错误: ${msg}`);
    this.name = "ManifestError";
    this.errors = errors;
  }
}
