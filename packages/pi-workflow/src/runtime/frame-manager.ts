import type { ExecutionFrame } from "./frame.js";

/** 帧管理器，负责创建执行帧 */
export class FrameManager {
  /**
   * 创建一个根帧
   * @param runId - 运行 ID
   * @param workflowId - 工作流 ID
   * @param input - 工作流输入数据
   */
  createRootFrame(runId: string, workflowId: string, input: Record<string, unknown>): ExecutionFrame {
    return {
      frameId: `${runId}/root`,
      runId,
      frameType: "root",
      workflowId,
      input,
      status: "running",
    };
  }
}
