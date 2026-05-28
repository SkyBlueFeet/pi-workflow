import { HeadlessExtensionAPI } from "./headless-extension-api.js";
import { stdinAskUser } from "./stdin-ask-user.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 扩展工具的定义，包含名称、描述、参数 schema 及执行函数。 */
export interface ExtensionTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}

/** 已加载扩展的完整记录，包含包名、版本号、工具列表及加载错误信息。 */
export interface LoadedExtension {
  readonly packageName: string;
  readonly version?: string;
  readonly tools: ExtensionTool[];
  readonly error?: string;
}

/**
 * 扩展桥接层，负责扫描、加载 PI 扩展包并将扩展工具适配为内部统一格式。
 * 支持从指定包列表或 node_modules 中自动发现扩展包。
 */
export class PiExtensionBridge {
  private readonly loaded: Map<string, LoadedExtension> = new Map();

  /**
   * 加载指定包名列表中的所有扩展。
   * 单个包加载失败时不会中断整体流程，错误信息会记入返回结果。
   *
   * @param packages 待加载的包名数组
   * @returns 每个包的加载结果数组
   */
  async loadFromPackages(packages: string[]): Promise<LoadedExtension[]> {
    const results: LoadedExtension[] = [];

    for (const pkg of packages) {
      try {
        const ext = await this.loadSingle(pkg);
        this.loaded.set(pkg, ext);
        results.push(ext);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const failed: LoadedExtension = { packageName: pkg, tools: [], error };
        this.loaded.set(pkg, failed);
        results.push(failed);
      }
    }

    return results;
  }

  /**
   * 自动扫描 node_modules 下所有声明了 pi.extensions 的包并加载。
   *
   * @returns 发现的扩展包加载结果数组
   */
  async loadFromNodeModules(): Promise<LoadedExtension[]> {
    const candidates = await this.scanNodeModules();
    return this.loadFromPackages(candidates);
  }

  /**
   * 获取所有已加载扩展的工具列表。
   *
   * @returns 所有扩展工具的扁平数组
   */
  getAllTools(): ExtensionTool[] {
    const all: ExtensionTool[] = [];
    for (const ext of this.loaded.values()) {
      all.push(...ext.tools);
    }
    return all;
  }

  /**
   * 获取已加载扩展的只读快照。
   *
   * @returns 包名到加载记录的映射副本
   */
  getLoaded(): Map<string, LoadedExtension> {
    return new Map(this.loaded);
  }

  /**
   * 获取内建工具列表。当前提供 ask_user_question 工具，
   * 用于在执行过程中通过交互式提问收集用户输入。
   *
   * @returns 内建工具数组
   */
  getNativeTools(): ExtensionTool[] {
    return [
      {
        name: "ask_user_question",
        description: `Ask the user one or more structured questions during execution. Use when you need to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices
4. Offer choices to the user

Parameters: questions array, each with:
- question (string): the question text
- header (string): short label (max 16 chars)
- options (array): 2-4 options, each with label and description
- multiSelect (boolean, optional): allow multiple selections`,
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  header: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                      },
                    },
                  },
                  multiSelect: { type: "boolean" },
                },
              },
            },
          },
        },
        execute: stdinAskUser,
      },
    ];
  }

  /**
   * 加载单个扩展包：实例化 HeadlessExtensionAPI，动态导入包并调用其 default export。
   *
   * @param pkg 包名
   * @throws 当包没有 default export 时抛出错误
   */
  private async loadSingle(pkg: string): Promise<LoadedExtension> {
    const extApi = new HeadlessExtensionAPI();
    const version = await this.resolveVersion(pkg);

    const mod = await import(pkg);
    if (typeof mod.default === "function") {
      await mod.default(extApi);
    } else {
      throw new Error(`Package ${pkg} has no default export`);
    }

    const tools = extApi.tools.map(t => this.bridgeTool(t));
    return { packageName: pkg, version, tools };
  }

  /**
   * 将扩展包的原始工具对象适配为统一的 ExtensionTool 接口。
   * 处理 execute 返回值的多种格式（字符串、content 数组、JSON）。
   *
   * @param tool 扩展包定义的原始工具对象
   */
  private bridgeTool(tool: { name: string; description?: string; parameters?: unknown; execute?: (...args: unknown[]) => unknown }): ExtensionTool {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown> | undefined,
      execute: async (params: Record<string, unknown>) => {
        if (!tool.execute) {
          return { content: `Tool ${tool.name} has no execute handler`, isError: true };
        }
        try {
          const raw = await tool.execute("", params, undefined, undefined, { hasUI: false });
          const result = raw as { content?: Array<{ type: string; text: string }> | string };
          const text = typeof result === "string"
            ? result
            : Array.isArray(result?.content)
              ? result.content.filter(c => c.type === "text").map(c => c.text).join("")
              : JSON.stringify(result);
          return { content: text, isError: false };
        } catch (err) {
          return { content: err instanceof Error ? err.message : String(err), isError: true };
        }
      },
    };
  }

  /**
   * 从扩展包的 package.json 中读取版本号。
   * 读取失败时返回 undefined，不中断加载流程。
   *
   * @param pkg 包名
   */
  private async resolveVersion(pkg: string): Promise<string | undefined> {
    try {
      const pj = (await import(`${pkg}/package.json`)) as { version?: string };
      return pj.version;
    } catch {
      return undefined;
    }
  }

  /**
   * 扫描 node_modules 下所有包，筛选出 package.json 中声明了 pi.extensions 的包名。
   * 仅扫描一级依赖及 @scope 作用域下的二级包。
   *
   * @returns 声明了扩展的包名数组
   */
  private async scanNodeModules(): Promise<string[]> {
    const nodeModulesPath = join(process.cwd(), "node_modules");
    if (!existsSync(nodeModulesPath)) {
      return [];
    }

    const found: string[] = [];
    for (const packageName of this.listInstalledPackageNames(nodeModulesPath)) {
      const packageJsonPath = join(nodeModulesPath, packageName, "package.json");
      try {
        const raw = readFileSync(packageJsonPath, "utf-8");
        const parsed = JSON.parse(raw) as { pi?: { extensions?: string[] } };
        if (parsed.pi?.extensions?.length) {
          found.push(packageName);
        }
      } catch {
        // 忽略非 JSON 包或不完整安装包
      }
    }

    return found;
  }

  /**
   * 列出 node_modules 目录下所有已安装的顶层包名（含 @scope 作用域）。
   *
   * @param nodeModulesPath node_modules 目录路径
   */
  private listInstalledPackageNames(nodeModulesPath: string): string[] {
    const packageNames: string[] = [];
    for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (entry.name.startsWith("@")) {
        const scopePath = join(nodeModulesPath, entry.name);
        for (const scopedEntry of readdirSync(scopePath, { withFileTypes: true })) {
          if (scopedEntry.isDirectory()) {
            packageNames.push(`${entry.name}/${scopedEntry.name}`);
          }
        }
        continue;
      }

      packageNames.push(entry.name);
    }

    return packageNames;
  }
}
