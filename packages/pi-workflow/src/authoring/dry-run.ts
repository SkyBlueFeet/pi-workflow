import { dslToIr } from "../dsl/mapper.js";
import type { WorkflowDslDocument } from "../dsl/types.js";
import { ManualExecutor, ReturnExecutor, UnsupportedExecutor } from "../executors/index.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { ExecutorRegistry, WorkflowRuntime } from "../runtime/index.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import { WorkflowLinter } from "./linter.js";
import type { WorkflowDryRunResult } from "./types.js";

export const AuthoringDryRunDiagnosticCodes = {
  UNSUPPORTED_NODE_KIND: "AUTH-DRY-001",
  RUNTIME_FAILURE: "AUTH-DRY-002",
} as const;

/**
 * 对 workflow 做 authoring 阶段 dry-run：先 lint，再尝试执行确定性节点。
 */
/** 对 workflow 执行 authoring 阶段 dry-run：lint 后运行确定性节点。 */
export class WorkflowDryRunner {
  private readonly linter = new WorkflowLinter();

  /**
   * 对原始对象执行 lint 并尝试有限运行。
   *
   * @param input 原始对象
   * @param runtimeInput 运行时输入参数
   * @returns dry-run 结果
   */
  async runObject(
    input: Record<string, unknown>,
    runtimeInput: Record<string, unknown> = {},
  ): Promise<WorkflowDryRunResult> {
    const lintResult = this.linter.lintObject(input);
    return this.runDocument(lintResult.document, lintResult.diagnostics, runtimeInput);
  }

  async runDocument(
    document: WorkflowDslDocument,
    diagnostics: readonly WorkflowDiagnostic[] = [],
    runtimeInput: Record<string, unknown> = {},
  ): Promise<WorkflowDryRunResult> {
    const collectedDiagnostics = [...diagnostics, ...collectUnsupportedNodeDiagnostics(document)];
    if (
      collectedDiagnostics.some(diagnostic => diagnostic.severity === "error")
      || collectedDiagnostics.some(diagnostic => diagnostic.code === AuthoringDryRunDiagnosticCodes.UNSUPPORTED_NODE_KIND)
    ) {
      return {
        document,
        diagnostics: collectedDiagnostics,
        runtimeEvents: [],
      };
    }

    const registry = createDryRunRegistry();
    const runtime = new WorkflowRuntime({ executorRegistry: registry });
    const runtimeEvents: WorkflowRuntimeEvent[] = [];

    try {
      const ir = dslToIr(document);
      const iterator = runtime.run({ ir, input: runtimeInput });
      let finalOutput: unknown;

      while (true) {
        const step = await iterator.next();
        if (step.done) {
          finalOutput = step.value.finalOutput;
          break;
        }
        runtimeEvents.push(step.value);
      }

      return {
        document,
        diagnostics: collectedDiagnostics,
        runtimeEvents,
        finalOutput,
      };
    } catch (error) {
      return {
        document,
        diagnostics: [
          ...collectedDiagnostics,
          {
            code: AuthoringDryRunDiagnosticCodes.RUNTIME_FAILURE,
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        runtimeEvents,
      };
    }
  }
}

/**
 * 便捷函数：对原始对象执行作者模式 dry-run。
 *
 * @param input 原始对象
 * @param runtimeInput 运行时输入参数
 * @returns dry-run 结果
 */
export async function dryRunWorkflowObject(
  input: Record<string, unknown>,
  runtimeInput: Record<string, unknown> = {},
): Promise<WorkflowDryRunResult> {
  return new WorkflowDryRunner().runObject(input, runtimeInput);
}

function createDryRunRegistry(): ExecutorRegistry {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  registry.register("agent", new UnsupportedExecutor());
  registry.register("tool", new UnsupportedExecutor());
  registry.register("http", new UnsupportedExecutor());
  registry.registerFallback(new UnsupportedExecutor());
  return registry;
}

function collectUnsupportedNodeDiagnostics(document: WorkflowDslDocument): WorkflowDiagnostic[] {
  return document.nodes.flatMap((node, index) => {
    if (isDryRunnableKind(node.executor.type)) {
      return [];
    }

    return [{
      code: AuthoringDryRunDiagnosticCodes.UNSUPPORTED_NODE_KIND,
      severity: "warning" as const,
      message: `dry-run 暂不执行节点类型 "${node.executor.type}"（节点 ${node.id}）`,
      nodeId: node.id,
      path: `nodes[${index}].executor.type`,
    }];
  });
}

function isDryRunnableKind(kind: WorkflowDslDocument["nodes"][number]["executor"]["type"]): boolean {
  return kind === "manual"
    || kind === "return"
    || kind === "workflow"
    || kind === "if"
    || kind === "parallel"
    || kind === "loop";
}
