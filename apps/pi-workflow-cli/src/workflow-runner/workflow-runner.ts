import type {
  WorkflowConfig,
  WorkflowDefinitionIR,
  WorkflowRunResult,
  WorkflowRunState,
  WorkflowRuntime,
} from "@pi-workflow/core";
import { createWorkflowDisplayShell } from "../display/workflow-display-shell.js";
import type {
  WorkflowDisplayMode,
  WorkflowDisplayRenderOptions,
} from "../display/workflow-display-renderer.js";

export interface RunWorkflowRequest {
  readonly runtime: WorkflowRuntime;
  readonly ir: WorkflowDefinitionIR;
  readonly input?: Record<string, unknown>;
  readonly config?: WorkflowConfig;
  readonly title?: string;
  readonly mode?: WorkflowDisplayMode;
  readonly display?: WorkflowDisplayRenderOptions;
  readonly loadRunState?: (workflowRunId: string) => Promise<WorkflowRunState | undefined>;
}

export interface ResumeWorkflowRequest {
  readonly runtime: WorkflowRuntime;
  readonly state: WorkflowRunState;
  readonly interactionInput: unknown;
  readonly config?: WorkflowConfig;
  readonly title?: string;
  readonly mode?: WorkflowDisplayMode;
  readonly display?: WorkflowDisplayRenderOptions;
  readonly loadRunState?: (workflowRunId: string) => Promise<WorkflowRunState | undefined>;
}

export interface WorkflowRunnerResult {
  readonly exitCode: number;
  readonly result: WorkflowRunResult;
}

/** 统一 workflow 运行器，负责驱动 runtime 并把事件流转给 shell。 */
export async function runWorkflowWithShell(
  request: RunWorkflowRequest | ResumeWorkflowRequest,
): Promise<WorkflowRunnerResult> {
  const mode = request.mode ?? "progress";
  const shell = createWorkflowDisplayShell({
    title: request.title,
    mode,
    renderOptions: request.display,
  });

  shell.begin();
  try {
    const generator: AsyncGenerator<import("@pi-workflow/core").WorkflowRuntimeEvent, WorkflowRunResult> = "ir" in request
      ? request.runtime.run({
        ir: request.ir,
        input: request.input,
        config: request.config,
      })
      : request.runtime.resume({
        state: request.state,
        interactionInput: request.interactionInput,
        config: request.config,
      });

    let next = await generator.next();
    while (!next.done) {
      shell.consume(next.value);
      next = await generator.next();
    }

    const result = next.value as WorkflowRunResult;
    shell.end();
    return {
      exitCode: isFailureResult(result) ? 1 : 0,
      result,
    };
  } catch (error) {
    shell.end();
    throw error;
  }
}

function isFailureResult(result: WorkflowRunResult): boolean {
  if (!result.finalOutput || typeof result.finalOutput !== "object") {
    return false;
  }
  return "error" in result.finalOutput;
}
