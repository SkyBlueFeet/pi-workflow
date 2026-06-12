/**
 * studio-console 内置资源安装模块。
 *
 * 职责：
 * 1. 在 `pi-studio-cli` 打包后，将 builtin/ 目录复制到全局资源位置
 * 2. 确保控制台启动时可以加载 studio-console agent 定义
 * 3. 处理跨平台路径解析与目录创建
 *
 * 说明：
 * - 全局资源位置由环境变量 PI_STUDIO_HOME 或平台默认路径决定
 * - 此模块仅在 `npm install -g`、`pnpm install` 的 postinstall 阶段或
 *   首次 `pi-studio --console` 时触发
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** 全局内置资源的目标根目录（骨架：使用 CWD 下的 .pi-studio）。 */
function resolveStudioHome(): string {
  // 优先级：PI_STUDIO_HOME > 用户目录 > CWD
  const envHome = process.env["PI_STUDIO_HOME"];
  if (envHome) {
    return resolve(envHome);
  }
  const userHome = process.env["USERPROFILE"] ?? process.env["HOME"];
  if (userHome) {
    return resolve(userHome, ".pi-studio");
  }
  return resolve(process.cwd(), ".pi-studio");
}

/** 获取内置资源源目录（编译后的 dist/builtin）。 */
function resolveBuiltinSource(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return resolve(__dirname, "..", "builtin");
}

/** 递归复制目录。 */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(src)) {
    return;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 将内置资源安装到全局位置。
 *
 * 流程：
 * 1. 解析全局资源根目录
 * 2. 若目标已存在，跳过（幂等）
 * 3. 递归复制 builtin/ 到目标
 *
 * @returns 安装后的资源根目录路径
 */
export function installStudioResources(): string {
  const studioHome = resolveStudioHome();
  const targetDir = resolve(studioHome, "builtin");

  if (existsSync(targetDir)) {
    // 幂等：已存在则跳过
    return targetDir;
  }

  mkdirSync(targetDir, { recursive: true });

  const sourceDir = resolveBuiltinSource();
  copyDirRecursive(sourceDir, targetDir);

  return targetDir;
}

/**
 * 检查内置资源是否已安装。
 */
export function isStudioResourcesInstalled(): boolean {
  const studioHome = resolveStudioHome();
  const targetDir = resolve(studioHome, "builtin", "agents", "studio-console.toml");
  return existsSync(targetDir);
}

/**
 * 确保内置资源存在，不存在则安装。
 *
 * @returns 资源根目录路径
 */
export function ensureStudioResources(): string {
  if (isStudioResourcesInstalled()) {
    return resolve(resolveStudioHome(), "builtin");
  }
  return installStudioResources();
}
