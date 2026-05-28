import { WorkflowLinter } from "./linter.js";
import type { WorkflowNodeKind } from "../ir/types.js";
import type { WorkflowAuthoringHost, WorkflowDraftRequest, WorkflowDraftResult } from "./types.js";

/** NL-to-DSL 回归测试的单条用例。 */
export interface WorkflowDraftEvalCase {
  readonly id: string;
  readonly request: WorkflowDraftRequest;
  readonly expectedNodeKinds?: readonly WorkflowNodeKind[];
}

/** 单条回归测试的执行结果。 */
export interface WorkflowDraftEvalCaseResult {
  readonly id: string;
  readonly passed: boolean;
  readonly errors: readonly string[];
  readonly draft?: WorkflowDraftResult;
}

/** 回归测试集的总结果汇总。 */
export interface WorkflowDraftEvalResult {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly cases: readonly WorkflowDraftEvalCaseResult[];
}

/**
 * 执行 NL-to-DSL 回归样例，验证生成结果至少可解析、无 error 诊断并满足节点类型预期。
 */
export async function evaluateWorkflowDrafts(
  host: WorkflowAuthoringHost,
  cases: readonly WorkflowDraftEvalCase[],
): Promise<WorkflowDraftEvalResult> {
  const results: WorkflowDraftEvalCaseResult[] = [];
  const linter = new WorkflowLinter();

  for (const evalCase of cases) {
    results.push(await evaluateCase(host, linter, evalCase));
  }

  const passed = results.filter(result => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    cases: results,
  };
}

async function evaluateCase(
  host: WorkflowAuthoringHost,
  linter: WorkflowLinter,
  evalCase: WorkflowDraftEvalCase,
): Promise<WorkflowDraftEvalCaseResult> {
  const errors: string[] = [];

  try {
    const draft = await consumeDraft(host, evalCase.request);
    const lint = linter.lintObject(draft.document as unknown as Record<string, unknown>);
    for (const diagnostic of [...draft.diagnostics, ...lint.diagnostics]) {
      if (diagnostic.severity === "error") {
        errors.push(`${diagnostic.code}: ${diagnostic.message}`);
      }
    }

    const actualKinds = draft.document.nodes.map(node => node.executor.type);
    for (const expectedKind of evalCase.expectedNodeKinds ?? []) {
      if (!actualKinds.includes(expectedKind)) {
        errors.push(`缺少预期节点类型: ${expectedKind}`);
      }
    }

    return { id: evalCase.id, passed: errors.length === 0, errors, draft };
  } catch (error) {
    return { id: evalCase.id, passed: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

async function consumeDraft(host: WorkflowAuthoringHost, request: WorkflowDraftRequest): Promise<WorkflowDraftResult> {
  const iterator = host.generateDraft(request);
  let result: WorkflowDraftResult | undefined;

  while (true) {
    const next = await iterator.next();
    if (next.done) {
      result = next.value;
      break;
    }
  }

  if (!result) {
    throw new Error("authoring host 未返回 draft result");
  }
  return result;
}
