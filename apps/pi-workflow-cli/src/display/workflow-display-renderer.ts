import { WorkflowProgressRenderer } from "./workflow-progress-renderer.js";
import { WorkflowTextRenderer } from "./workflow-text-renderer.js";
import type { WorkflowDisplaySnapshot } from "./workflow-display-model.js";
import type { WorkflowDisplayEvent } from "./workflow-display-events.js";

export type WorkflowDisplayMode = "plain" | "progress";

export interface WorkflowDisplayRenderOptions {
  readonly showFinalOutput?: boolean;
}

export interface WorkflowDisplayRenderer {
  start(snapshot: WorkflowDisplaySnapshot): void;
  renderEvent(event: WorkflowDisplayEvent, snapshot: WorkflowDisplaySnapshot): void;
  finish(snapshot: WorkflowDisplaySnapshot): void;
}

/** 根据展示模式选择 renderer；progress 作为默认展示层，不依赖 TTY 自动探测。 */
export function createWorkflowDisplayRenderer(
  mode: WorkflowDisplayMode,
  options: WorkflowDisplayRenderOptions = {},
): WorkflowDisplayRenderer {
  return mode === "progress"
    ? new WorkflowProgressRenderer(options)
    : new WorkflowTextRenderer(options);
}
