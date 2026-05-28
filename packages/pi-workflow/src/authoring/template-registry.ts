import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadFromDirectory } from "../dsl/directory-loader.js";
import type { WorkflowTemplateLoadResult, WorkflowTemplateSummary } from "./types.js";

interface TemplateManifest {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
}

/**
 * 基于文件系统目录管理 workflow 模板。
 */
/** 基于文件系统目录管理 workflow 模板的注册表。 */
export class WorkflowTemplateRegistry {
  constructor(private readonly rootDir: string) {}

  /**
   * 列出所有可用的模板摘要。
   *
   * @returns 模板摘要列表
   */
  listTemplates(): WorkflowTemplateSummary[] {
    if (!existsSync(this.rootDir)) {
      return [];
    }

    return readdirSync(this.rootDir)
      .map(entry => resolve(this.rootDir, entry))
      .filter(entryPath => statSync(entryPath).isDirectory())
      .map(entryPath => this.readTemplateSummary(entryPath))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  /**
   * 加载指定模板的完整内容（含 DSL 文档）。
   *
   * @param templateId 模板 ID
   * @returns 模板加载结果
   */
  loadTemplate(templateId: string): WorkflowTemplateLoadResult {
    const templateDir = resolve(this.rootDir, templateId);
    const template = this.readTemplateSummary(templateDir);
    const workflowDir = resolve(templateDir, "workflow");
    const { document, diagnostics } = loadFromDirectory(workflowDir);

    return {
      template,
      document,
      diagnostics,
    };
  }

  private readTemplateSummary(templateDir: string): WorkflowTemplateSummary {
    const manifestPath = resolve(templateDir, "template.json");
    const manifest = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, "utf-8")) as TemplateManifest
      : {};

    const id = manifest.id ?? basename(templateDir);
    const title = manifest.title ?? id;
    return {
      id,
      title,
      description: manifest.description,
      tags: manifest.tags?.filter((tag): tag is string => typeof tag === "string") ?? [],
      templateDir,
    };
  }
}

/**
 * 创建基于指定根目录的模板注册表。
 *
 * @param rootDir 模板根目录
 * @returns 注册表实例
 */
export function createWorkflowTemplateRegistry(rootDir: string): WorkflowTemplateRegistry {
  return new WorkflowTemplateRegistry(rootDir);
}
