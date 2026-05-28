import type { WorkflowHostCapabilities } from "./types.js";

/** 空宿主实现，不提供任何宿主能力，适用于测试或无宿主环境。 */
export const NullWorkflowHost: WorkflowHostCapabilities = {};
