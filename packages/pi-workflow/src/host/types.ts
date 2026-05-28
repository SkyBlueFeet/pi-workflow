import type { WorkflowRuntimeEvent } from "../events/types.js";

/** 宿主环境能力接口，定义工作流引擎调用宿主能力的协议。 */
export interface WorkflowHostCapabilities {
  emitEvent?(event: WorkflowRuntimeEvent): void | Promise<void>;
}
