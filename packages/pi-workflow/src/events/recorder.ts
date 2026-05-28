import type { WorkflowRuntimeEvent } from "./types.js";

/** 事件记录器，按添加顺序存储运行时事件并支持按类型筛选。 */
export class EventRecorder {
  readonly events: WorkflowRuntimeEvent[] = [];

  /** 记录一条运行时事件。 */
  record(event: WorkflowRuntimeEvent): void {
    this.events.push(event);
  }

  /** 按事件类型筛选已记录的事件列表。 */
  getEventsByType(type: WorkflowRuntimeEvent["type"]): WorkflowRuntimeEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /** 清空所有已记录的事件。 */
  clear(): void {
    this.events.length = 0;
  }
}
