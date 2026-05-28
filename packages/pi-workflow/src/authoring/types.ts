import type { WorkflowDslDocument } from "../dsl/types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";

/**
 * 描述 authoring 阶段可自动执行的一条修复建议。
 */
export interface WorkflowSuggestedFix {
  readonly code: string;
  readonly action: "remove-node" | "connect-node";
  readonly description: string;
  readonly nodeId?: string;
  readonly path?: string;
}

/**
 * 返回静态检查后的文档、诊断和建议修复动作。
 */
export interface WorkflowLintResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
  readonly suggestedFixes: readonly WorkflowSuggestedFix[];
}

/**
 * 描述一次自动修复执行后的文档结果与应用记录。
 */
export interface WorkflowFixResult {
  readonly document: WorkflowDslDocument;
  readonly appliedFixes: readonly WorkflowSuggestedFix[];
  readonly skippedFixes: readonly WorkflowSuggestedFix[];
}

/**
 * 面向人类阅读的 workflow 摘要结果。
 */
export interface WorkflowRenderResult {
  readonly summary: string;
  readonly lines: readonly string[];
}

/**
 * dry-run 的统一返回结构，包含静态诊断与最小执行结果。
 */
export interface WorkflowDryRunResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
  readonly runtimeEvents: readonly WorkflowRuntimeEvent[];
  readonly finalOutput?: unknown;
}

/**
 * 模板注册表中的元信息视图。
 */
export interface WorkflowTemplateSummary {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly templateDir: string;
}

/**
 * 模板加载后的完整结果，包含元信息、文档和诊断。
 */
export interface WorkflowTemplateLoadResult {
  readonly template: WorkflowTemplateSummary;
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

/** Authoring 主机的阶段事件：生成中 / 完成 / 错误。 */
export interface WorkflowAuthoringHostEvent {
  readonly type: "generating" | "done" | "error";
  readonly message?: string;
}

/** 生成 workflow 草案的请求参数。 */
export interface WorkflowDraftRequest {
  readonly prompt: string;
  readonly constraints?: Readonly<Record<string, unknown>>;
  readonly templateRef?: string;
  readonly signal?: AbortSignal;
}

/** 草案生成的结果，包含 DSL 文档与诊断。 */
export interface WorkflowDraftResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

/** Authoring 主机的抽象接口，负责将自然语言 prompt 转译为 DSL 草案。 */
export interface WorkflowAuthoringHost {
  generateDraft(request: WorkflowDraftRequest): AsyncGenerator<WorkflowAuthoringHostEvent, WorkflowDraftResult>;
}
