import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { loadLockfile, saveLockfile } from "./pi-package-lockfile.js";
import { computeIntegrityHash, isTrusted } from "./pi-package-trust.js";

const PI_WORKFLOW_DIR = ".pi-workflow";

/** 包来源类型：npm 注册表、git 仓库、本地文件系统。 */
export type PackageSourceType = "npm" | "git" | "file";
/** 包来源的详细描述，包含类型、spec 及对应类型特有字段。 */
export interface PackageSource {
  readonly type: PackageSourceType;
  readonly spec: string;
  readonly url?: string;
  readonly ref?: string;
  readonly path?: string;
}
/** 包声明，用于在工作流中注册一个包并指定其来源。 */
export interface PackageDeclaration {
  readonly alias: string;
  readonly source: PackageSource;
  readonly enabled?: boolean;
}
/** 已安装包的完整持久化记录，包含版本、路径、完整性哈希及安装时间。 */
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
/** 安装操作的结果，包含记录及是否已存在标记。 */
export interface InstallResult {
  readonly record: InstalledPackageRecord;
  readonly existing: boolean;
}
/** 包的查询信息，包含持久化记录与资源访问权限状态。 */
export interface PackageInfo {
  readonly record: InstalledPackageRecord;
  readonly resourceAccessAllowed: boolean;
}
/** package.json 中 pi 字段的声明结构，定义扩展、技能、提示词及主题。 */
interface PiPackageManifest {
  readonly extensions?: readonly string[];
  readonly skills?: readonly string[];
  readonly prompts?: readonly string[];
  readonly themes?: readonly string[];
}

/**
 * 通过 PI 自带安装器完成包安装，并把结果同步回 workflow 锁文件。
 */
export async function installPackageWithPi(
  declaration: PackageDeclaration,
  cwd?: string,
): Promise<InstallResult> {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const existing = loadLockfile(resolvedCwd).packages[declaration.alias];
  if (existing) {
    return { record: existing, existing: true };
  }
  const sourceString = toPiSourceString(declaration.source);
  const manager = createPackageManager(resolvedCwd);
  await manager.installAndPersist(sourceString);
  const rootPath = manager.getInstalledPath(sourceString, "user");
  if (!rootPath) {
    throw new Error(`PI 安装器未返回已安装路径: ${sourceString}`);
  }
  const record = buildInstalledRecord(declaration, rootPath);
  const lockfile = loadLockfile(resolvedCwd);
  lockfile.packages[declaration.alias] = record;
  saveLockfile(lockfile, resolvedCwd);
  return { record, existing: false };
}

/**
 * 卸载 workflow 记录的包，并委托 PI 安装器清理其安装产物。
 */
export async function uninstallPackageWithPi(alias: string, cwd?: string): Promise<boolean> {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const lockfile = loadLockfile(resolvedCwd);
  const record = lockfile.packages[alias];
  if (!record) {
    return false;
  }
  const source = parsePackageSource(record.source);
  const sourceString = toPiSourceString(source);
  const manager = createPackageManager(resolvedCwd);
  await manager.removeAndPersist(sourceString);
  delete lockfile.packages[alias];
  saveLockfile(lockfile, resolvedCwd);
  return true;
}

/** 列出锁文件中记录的所有已安装包及其资源访问权限。 */
export function listInstalledPackages(cwd?: string): PackageInfo[] {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const lockfile = loadLockfile(resolvedCwd);
  return Object.values(lockfile.packages).map((record) => ({
    record,
    resourceAccessAllowed: isTrusted(record.alias, parsePackageSource(record.source), resolvedCwd),
  }));
}

/**
 * 根据别名查询单个已安装包的详细信息及资源访问权限。
 *
 * @param alias 包别名
 * @param cwd 工作目录
 */
export function getInstalledPackageInfo(alias: string, cwd?: string): PackageInfo | undefined {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const lockfile = loadLockfile(resolvedCwd);
  const record = lockfile.packages[alias];
  if (!record) {
    return undefined;
  }
  return {
    record,
    resourceAccessAllowed: isTrusted(record.alias, parsePackageSource(record.source), resolvedCwd),
  };
}

/** 从 PI settings 中读取已配置包，并映射为 workflow 可消费的 alias -> source 声明。 */
export function getConfiguredWorkflowPackages(cwd?: string): Record<string, string> {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const settingsManager = createSettingsManager(resolvedCwd);
  const configuredSources = new Set<string>();
  for (const entry of settingsManager.getGlobalSettings().packages ?? []) {
    configuredSources.add(normalizeConfiguredSource(typeof entry === "string" ? entry : entry.source));
  }
  for (const entry of settingsManager.getProjectSettings().packages ?? []) {
    configuredSources.add(normalizeConfiguredSource(typeof entry === "string" ? entry : entry.source));
  }
  if (configuredSources.size === 0) {
    return {};
  }
  const lockfile = loadLockfile(resolvedCwd);
  const mapped: Record<string, string> = {};
  for (const record of Object.values(lockfile.packages)) {
    if (configuredSources.has(normalizeConfiguredSource(record.source))) {
      mapped[record.alias] = record.source;
    }
  }
  return mapped;
}

/**
 * 将规范格式的源字符串解析为 PackageSource 结构。
 * 支持 "npm:", "git:", "file:" 前缀，默认以 npm 类型处理。
 *
 * @param spec 源字符串，如 "npm:lodash"、"git:https://...#v1"、"file:./local"
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

/** 将 PackageSource 结构序列化为规范格式的源字符串。 */
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

/** 确保 .pi-workflow 元数据目录存在，不存在则创建。 */
export function ensureWorkflowDir(cwd?: string): string {
  const dir = resolve(cwd ?? process.cwd(), PI_WORKFLOW_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function createPackageManager(cwd: string): DefaultPackageManager {
  return new DefaultPackageManager({ cwd, agentDir: resolve(cwd, PI_WORKFLOW_DIR), settingsManager: createSettingsManager(cwd) });
}

function createSettingsManager(cwd: string): SettingsManager {
  return SettingsManager.create(cwd, resolve(cwd, PI_WORKFLOW_DIR));
}

function toPiSourceString(source: PackageSource): string {
  switch (source.type) {
    case "npm":
      return packageSourceToString(source);
    case "git":
      return packageSourceToString(source);
    case "file":
      return resolve(source.path ?? "");
  }
}

function buildInstalledRecord(declaration: PackageDeclaration, rootPath: string): InstalledPackageRecord {
  const sourceString = packageSourceToString(declaration.source);
  const packageJson = readPackageJson(rootPath);
  return {
    alias: declaration.alias,
    packageName: packageJson.name ?? declaration.alias,
    version: packageJson.version ?? "0.0.0",
    source: sourceString,
    rootPath,
    integrityHash: computeIntegrityHash(rootPath),
    executable: isPackageExecutable(declaration.source, rootPath),
    installedAt: new Date().toISOString(),
  };
}

function isPackageExecutable(source: PackageSource, rootPath: string): boolean {
  if (source.type === "git") return false;
  try {
    loadManifest(rootPath);
    return true;
  } catch {
    return false;
  }
}

function readPackageJson(rootPath: string): { name?: string; version?: string } {
  const packageJsonPath = join(rootPath, "package.json");
  if (!existsSync(packageJsonPath)) return {};
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { name?: string; version?: string };
  } catch {
    return {};
  }
}

function loadManifest(packageRoot: string): PiPackageManifest {
  const packageJsonPath = resolve(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json 不存在于: ${packageRoot}`);
  }
  const pkgJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { pi?: PiPackageManifest };
  if (!pkgJson.pi || typeof pkgJson.pi !== "object") {
    throw new Error("package.json 缺少 pi 字段或 pi 字段不是对象类型");
  }
  return pkgJson.pi;
}

function normalizeConfiguredSource(source: string): string {
  if (source.startsWith("npm:") || source.startsWith("git:") || source.startsWith("file:")) return source;
  return `file:${resolve(source)}`;
}
