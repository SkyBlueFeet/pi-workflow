import type { WorkflowRuntimeEvent } from "./types.js";

/** 事件发射器，支持注册/注销监听器并向所有监听器广播运行时事件。 */
export class EventEmitter {
  private listeners: Array<(event: WorkflowRuntimeEvent) => void> = [];

  /** 注册事件监听器。 */
  on(handler: (event: WorkflowRuntimeEvent) => void): void {
    this.listeners.push(handler);
  }

  /** 移除已注册的事件监听器。 */
  off(handler: (event: WorkflowRuntimeEvent) => void): void {
    this.listeners = this.listeners.filter(h => h !== handler);
  }

  /** 向所有已注册的监听器广播事件。 */
  emit(event: WorkflowRuntimeEvent): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }
}
