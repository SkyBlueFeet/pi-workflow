import type { WorkflowHostEvent } from "./types.js";
import type { WorkflowRuntimeEvent } from "../../events/types.js";

/**
 * 将 PI 宿主事件映射为标准运行时事件。
 * agent.text_delta → node.progress；agent.error → node.failed；其他暂不映射。
 *
 * @param hostEvent PI 宿主事件
 * @param workflowRunId 工作流运行 ID
 * @param nodeId 节点 ID
 * @returns 运行时事件，无需映射时返回 undefined
 */
export function mapHostEventToRuntimeEvent(
  hostEvent: WorkflowHostEvent,
  workflowRunId: string,
  nodeId: string,
): WorkflowRuntimeEvent | undefined {
  switch (hostEvent.type) {
    case "agent.text_delta":
      return {
        type: "node.progress",
        workflowRunId,
        nodeId,
        message: hostEvent.delta,
        delta: hostEvent.delta,
      };
    case "agent.tool_start":
      return {
        type: "node.progress",
        workflowRunId,
        nodeId,
        message: `工具调用: ${hostEvent.toolName}`,
      };
    case "agent.tool_end":
      return {
        type: "node.progress",
        workflowRunId,
        nodeId,
        message: `工具完成: ${hostEvent.toolName}`,
      };
    case "agent.error":
      return {
        type: "node.failed",
        workflowRunId,
        nodeId,
        error: hostEvent.error,
      };
    default:
      return undefined;
  }
}
