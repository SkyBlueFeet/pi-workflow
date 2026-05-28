import type { ResolvedPackage } from "../../config/package-resolver.js";
import { buildExtensionCatalog, type ExtensionEntry } from "./extension-catalog.js";

/** 可执行的扩展执行器。 */
export interface ExtensionExecutor {
  readonly name: string;
  readonly packageAlias: string;
  readonly run: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
}

/** 扩展加载的结果，包含成功与失败的条目。 */
export interface ExtensionLoadResult {
  readonly loaded: ExtensionExecutor[];
  readonly failed: ExtensionEntry[];
}

/**
 * 从已解析的包中加载所有可执行的扩展。
 *
 * @param resolvedPackages 已解析的包列表
 * @returns 扩展加载结果
 */
export function loadExecutableExtensions(
  resolvedPackages: ResolvedPackage[],
): ExtensionLoadResult {
  const catalog = buildExtensionCatalog(resolvedPackages);
  const loaded: ExtensionExecutor[] = [];
  const failed: ExtensionEntry[] = [];

  for (const entry of catalog) {
    if (!entry.executable) {
      if (entry.error) failed.push(entry);
      continue;
    }

    const executor = tryLoadExtension(entry);
    if (executor) {
      loaded.push(executor);
    } else {
      failed.push(entry);
    }
  }

  return { loaded, failed };
}

function tryLoadExtension(entry: ExtensionEntry): ExtensionExecutor | undefined {
  try {
    const run = async (params: Record<string, unknown>) => {
      return {
        content: JSON.stringify({ toolName: entry.name, params, result: "ok (stub)" }),
        isError: false,
      };
    };

    return {
      name: entry.name,
      packageAlias: entry.packageAlias,
      run,
    };
  } catch {
    return undefined;
  }
}
