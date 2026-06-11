import type { WorkflowRuntimeEvent } from "@pi-workflow/core";
import { createWorkflowRenderer } from "./workflow-renderer.js";
import { WorkflowViewModel } from "./workflow-view-model.js";

export interface WorkflowShell {
  begin(): void;
  consume(event: WorkflowRuntimeEvent): void;
  end(): void;
}

export interface CreateWorkflowShellOptions {
  readonly title?: string;
  readonly mode: "text";
}

/** 创建文本模式 workflow shell，负责统一消费事件并输出整理后的观察视图。 */
export function createWorkflowShell(options: CreateWorkflowShellOptions): WorkflowShell {
  const viewModel = new WorkflowViewModel(options.title);
  const renderer = createWorkflowRenderer(options.mode);

  return {
    begin(): void {
      renderer.start(viewModel.getSnapshot());
    },
    consume(event: WorkflowRuntimeEvent): void {
      viewModel.apply(event);
      renderer.renderEvent(event, viewModel.getSnapshot());
    },
    end(): void {
      renderer.finish(viewModel.getSnapshot());
    },
  };
}
