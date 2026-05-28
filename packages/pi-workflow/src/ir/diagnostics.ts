/** 工作流诊断信息，包含错误码、严重级别及关联节点/文件路径。 */
export interface WorkflowDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path?: string;
  readonly nodeId?: string;
}

/** 工作流诊断错误异常，聚合多条诊断信息后抛出。 */
export class WorkflowDiagnosticError extends Error {
  constructor(
    public readonly diagnostics: readonly WorkflowDiagnostic[],
  ) {
    const messages = diagnostics.map(d => `[${d.severity}] ${d.code}: ${d.message}`).join("; ");
    super(messages);
    this.name = "WorkflowDiagnosticError";
  }
}
