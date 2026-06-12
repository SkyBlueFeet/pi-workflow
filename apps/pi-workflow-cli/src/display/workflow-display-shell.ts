import type { WorkflowRuntimeEvent } from "@pi-workflow/core";
import { mapRuntimeEventToDisplayEvents } from "./workflow-display-events.js";
import { WorkflowDisplayModel } from "./workflow-display-model.js";
import {
  createWorkflowDisplayRenderer,
  type WorkflowDisplayMode,
  type WorkflowDisplayRenderOptions,
} from "./workflow-display-renderer.js";

export interface WorkflowDisplayShell {
  begin(): void;
  consume(event: WorkflowRuntimeEvent): void;
  end(): void;
}

export interface CreateWorkflowDisplayShellOptions {
  readonly title?: string;
  readonly mode: WorkflowDisplayMode;
  readonly renderOptions?: WorkflowDisplayRenderOptions;
}

/** 创建展示 shell，统一完成 runtime 事件到展示协议与 renderer 的桥接。 */
export function createWorkflowDisplayShell(options: CreateWorkflowDisplayShellOptions): WorkflowDisplayShell {
  const model = new WorkflowDisplayModel(options.title);
  const renderer = createWorkflowDisplayRenderer(options.mode, options.renderOptions);

  return {
    begin(): void {
      renderer.start(model.getSnapshot());
    },
    consume(event: WorkflowRuntimeEvent): void {
      const displayEvents = mapRuntimeEventToDisplayEvents(event);
      for (const displayEvent of displayEvents) {
        model.apply(displayEvent);
        renderer.renderEvent(displayEvent, model.getSnapshot());
      }
    },
    end(): void {
      renderer.finish(model.getSnapshot());
    },
  };
}
