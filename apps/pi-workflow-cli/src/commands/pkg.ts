import {
  getPackageInfo,
  installPackage,
  listPackages,
  parsePackageSource,
  packageSourceToString,
  uninstallPackage,
} from "@pi-workflow/core";
import type { PackageDeclaration } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

const logger = createLogger("pkg");

/**
 * pkg 命令入口：PI 包管理，支持 install / list / info / uninstall 子命令。
 *
 * @param args 命令行参数，args[0] 为子命令名
 */
export async function pkgCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case "install":
      await pkgInstall(args.slice(1));
      break;
    case "list":
      await pkgList();
      break;
    case "info":
      await pkgInfo(args.slice(1));
      break;
    case "uninstall":
      await pkgUninstall(args.slice(1));
      break;
    default:
      console.log("pi-workflow pkg - PI 包管理");
      console.log("");
      console.log("用法:");
      console.log("  pi-workflow pkg install <source>    使用 PI 安装器安装包并登记");
      console.log("  pi-workflow pkg list                列出已安装包");
      console.log("  pi-workflow pkg info <alias>        查看包详情");
      console.log("  pi-workflow pkg uninstall <alias>   卸载包");
      console.log("");
      console.log("源格式:");
      console.log("  npm:<name>@<range>                  通过 PI 安装器安装 npm 包");
      console.log("  git:<url>#<ref>                     通过 PI 安装器克隆 git 包");
      console.log("  file:<path>                         记录本地包路径并接入资源解析");
      break;
  }
}

/**
 * 安装一个或多个 PI 包，通过 PI 安装器完成并登记到 workflow 锁文件。
 * 退出码：0 正常，1 安装失败。
 *
 * @param sources 包源字符串数组，格式 "npm:<name>@<range>"、"git:<url>#<ref>"、"file:<path>"
 */
async function pkgInstall(sources: string[]): Promise<void> {
  if (sources.length === 0) {
    logger.error("错误: 请指定要安装的包源");
    logger.error("用法: pi-workflow pkg install <source> [alias]");
    process.exit(1);
  }

  for (const arg of sources) {
    const [spec, aliasRaw] = arg.split("=");
    const alias = aliasRaw ?? guessAlias(spec);
    const source = parsePackageSource(spec);

    const decl: PackageDeclaration = { alias, source };
    try {
      const result = await installPackage(decl);
      if (result.existing) {
        logger.info(`包 "${alias}" 已安装 (${result.record.version})`);
      } else {
        const trustLabel = source.type === "git" ? "deny" : "resource-only";
        console.log(`✓ 包 "${alias}" 已通过 PI 安装并写入 workflow 锁文件`);
        console.log(`  版本: ${result.record.version}`);
        console.log(`  来源: ${packageSourceToString(source)}`);
        console.log(`  可执行: ${result.record.executable ? "是" : "否"}`);
        console.log(`  信任级别: ${trustLabel} (默认)`);
      }
    } catch (err) {
      logger.error(`包 "${alias}" 安装失败: ${String(err)}`);
      process.exit(1);
    }
  }
}

/**
 * 列出所有已安装的 PI 包，显示版本、来源、可执行状态与资源访问权限。
 */
async function pkgList(): Promise<void> {
  const packages = listPackages();
  if (packages.length === 0) {
    logger.info("未安装任何 PI 包");
    return;
  }

  console.log("已安装的 PI 包:");
  console.log("");
  for (const pkg of packages) {
    const access = pkg.resourceAccessAllowed ? "资源可读" : "拒绝";
    console.log(`  ${pkg.record.alias}`);
    console.log(`    版本: ${pkg.record.version}`);
    console.log(`    来源: ${pkg.record.source}`);
    console.log(`    可执行: ${pkg.record.executable ? "是" : "否"}`);
    console.log(`    权限: ${access}`);
    console.log("");
  }
}

/**
 * 查看指定包的详细信息，包括版本、路径、完整性哈希、资源访问权限等。
 * 退出码：0 正常，1 未指定别名或包未安装。
 *
 * @param args 命令行参数，args[0] 为包别名
 */
async function pkgInfo(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定包别名");
    logger.error("用法: pi-workflow pkg info <alias>");
    process.exit(1);
  }

  const alias = args[0];
  const info = getPackageInfo(alias);
  if (!info) {
    logger.error(`包 "${alias}" 未安装`);
    process.exit(1);
  }

  console.log(`包: ${info.record.alias}`);
  console.log(`  包名: ${info.record.packageName}`);
  console.log(`  版本: ${info.record.version}`);
  console.log(`  来源: ${info.record.source}`);
  console.log(`  路径: ${info.record.rootPath}`);
  console.log(`  可执行: ${info.record.executable ? "是" : "否"}`);
  console.log(`  完整性: ${info.record.integrityHash}`);
  console.log(`  安装时间: ${info.record.installedAt}`);
  console.log(`  资源访问: ${info.resourceAccessAllowed ? "允许" : "拒绝"}`);
}

/**
 * 卸载指定 PI 包并从锁文件中移除记录。
 * 退出码：0 正常，1 未指定别名或包未安装。
 *
 * @param args 命令行参数，args[0] 为包别名
 */
async function pkgUninstall(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error("错误: 请指定要卸载的包别名");
    logger.error("用法: pi-workflow pkg uninstall <alias>");
    process.exit(1);
  }

  const alias = args[0];
  const removed = await uninstallPackage(alias);
  if (removed) {
    console.log(`✓ 包 "${alias}" 已卸载`);
  } else {
    logger.error(`包 "${alias}" 未安装`);
    process.exit(1);
  }
}

/**
 * 根据包源 spec 自动推断别名。
 * npm 类型取 @ 分隔的第一段，git 类型取 URL 最后一段（去除 .git），
 * file 类型取路径的最后一级目录名。
 *
 * @param spec 包源字符串
 * @returns 推断的别名
 */
function guessAlias(spec: string): string {
  const source = parsePackageSource(spec);
  switch (source.type) {
    case "npm":
      return source.spec.split("@")[0] ?? source.spec;
    case "git": {
      const url = source.url ?? "";
      const parts = url.split("/");
      const last = parts[parts.length - 1] ?? url;
      return last.replace(/\.git$/, "");
    }
    case "file": {
      const parts = (source.path ?? "").split(/[/\\]/);
      return parts[parts.length - 1] ?? "local-package";
    }
    default:
      return "unknown-package";
  }
}
