import { readFileSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";

/** 已解析文件的结果：内容与绝对路径。 */
export interface ResolvedFile {
  readonly content: string;
  readonly absolutePath: string;
}

/** 基于基准目录解析和读取文件的工具类。 */
export class FileResolver {
  constructor(private readonly baseDir: string) {}

  /**
   * 将引用路径解析为绝对路径（相对路径基于 baseDir）。
   *
   * @param refPath 引用路径
   * @returns 绝对路径
   */
  resolvePath(refPath: string): string {
    if (isAbsolute(refPath)) return refPath;
    return resolve(this.baseDir, refPath);
  }

  /**
   * 读取文本文件并返回内容与绝对路径。
   *
   * @param refPath 引用路径
   * @returns 文件内容与绝对路径
   */
  readTextFile(refPath: string): ResolvedFile {
    const absolutePath = this.resolvePath(refPath);
    const content = readFileSync(absolutePath, "utf-8");
    return { content, absolutePath };
  }

  /**
   * 读取 JSON 文件并解析为指定类型。
   *
   * @param refPath 引用路径
   * @returns 解析后的 JSON 对象
   */
  readJsonFile<T = Record<string, unknown>>(refPath: string): T {
    const { content } = this.readTextFile(refPath);
    return JSON.parse(content) as T;
  }

  /**
   * 基于基准文件解析相对路径。
   *
   * @param base 基准文件路径
   * @param relative 相对路径
   * @returns 合并后的绝对路径
   */
  resolveRelative(base: string, relative: string): string {
    return resolve(dirname(base), relative);
  }
}
