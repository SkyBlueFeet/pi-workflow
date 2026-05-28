import type { WorkflowPiPackageRef, WorkflowPiCapabilityRef, WorkflowCapabilityCatalog } from "./types.js";

/** PI 能力目录的构建器，支持逐步添加包、技能、提示、工具以及诊断信息。 */
export class PiCapabilityCatalogBuilder {
  private packages: WorkflowPiPackageRef[] = [];
  private skills: WorkflowPiCapabilityRef[] = [];
  private prompts: WorkflowPiCapabilityRef[] = [];
  private tools: WorkflowPiCapabilityRef[] = [];
  private diagnostics: string[] = [];

  /**
   * 添加包引用。
   *
   * @param ref 包引用
   */
  addPackage(ref: WorkflowPiPackageRef): void {
    this.packages.push(ref);
  }

  /**
   * 添加技能能力引用。
   *
   * @param ref 能力引用
   */
  addSkill(ref: WorkflowPiCapabilityRef): void {
    this.skills.push(ref);
  }

  /**
   * 添加提示能力引用。
   *
   * @param ref 能力引用
   */
  addPrompt(ref: WorkflowPiCapabilityRef): void {
    this.prompts.push(ref);
  }

  /**
   * 添加工具能力引用。
   *
   * @param ref 能力引用
   */
  addTool(ref: WorkflowPiCapabilityRef): void {
    this.tools.push(ref);
  }

  /**
   * 添加构建过程中的诊断信息。
   *
   * @param msg 诊断消息
   */
  addDiagnostic(msg: string): void {
    this.diagnostics.push(msg);
  }

  /** 构建最终的能力目录。 */
  build(): WorkflowCapabilityCatalog {
    return {
      packages: [...this.packages],
      skills: [...this.skills],
      prompts: [...this.prompts],
      tools: [...this.tools],
    };
  }

  /** 获取构建过程中累积的诊断消息。 */
  getDiagnostics(): readonly string[] {
    return [...this.diagnostics];
  }
}

/**
 * 将来源字符串解析为结构化的包来源信息。
 * 支持 npm:/git: 前缀及本地路径检测。
 *
 * @param source 来源字符串
 * @returns 结构化来源（类型+路径）
 */
export function resolvePackageSource(source: string): { type: "npm" | "git" | "local"; path: string } {
  if (source.startsWith("npm:")) {
    return { type: "npm", path: source.slice(4) };
  }
  if (source.startsWith("git:")) {
    return { type: "git", path: source.slice(4) };
  }
  if (source.startsWith(".") || source.startsWith("/")) {
    return { type: "local", path: source };
  }
  return { type: "npm", path: source };
}
