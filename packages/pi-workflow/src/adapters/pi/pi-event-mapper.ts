import type { PiRuntimeEvent } from "../../agents/types.js";
import type { WorkflowHostEvent } from "./types.js";
import type { WorkflowRuntimeEvent } from "../../events/types.js";

/** 将 backend 产出的 PiRuntimeEvent 适配为 WorkflowHostEvent。 */
export function mapPiRuntimeEventToHostEvent(runtimeEvent: PiRuntimeEvent): WorkflowHostEvent | undefined {
  switch (runtimeEvent.type) {
    case "text_delta":
      return { type: "agent.text_delta", delta: runtimeEvent.delta };
    case "tool_start":
      return { type: "agent.tool_start", toolName: runtimeEvent.toolName };
    case "tool_end":
      return { type: "agent.tool_end", toolName: runtimeEvent.toolName };
    case "skill_start":
      return { type: "agent.skill_start", skillName: runtimeEvent.skillName };
    case "skill_end":
      return { type: "agent.skill_end", skillName: runtimeEvent.skillName };
    case "mcp_start":
      return { type: "agent.mcp_start", serverName: runtimeEvent.serverName };
    case "mcp_end":
      return { type: "agent.mcp_end", serverName: runtimeEvent.serverName };
    case "run_error":
      return { type: "agent.error", error: runtimeEvent.error };
    case "unmapped":
      return { type: "agent.unmapped", eventType: runtimeEvent.eventType, payload: runtimeEvent.payload };
    default:
      return undefined;
  }
}

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
        type: "agent.message.delta",
        workflowRunId,
        nodeId,
        delta: hostEvent.delta,
      };
    case "agent.tool_start":
      return {
        type: "agent.tool.started",
        workflowRunId,
        nodeId,
        toolName: hostEvent.toolName,
      };
    case "agent.tool_end":
      return {
        type: "agent.tool.completed",
        workflowRunId,
        nodeId,
        toolName: hostEvent.toolName,
      };
    case "agent.error":
      return {
        type: "node.failed",
        workflowRunId,
        nodeId,
        error: hostEvent.error,
      };
    case "agent.unmapped":
      return {
        type: "node.progress",
        workflowRunId,
        nodeId,
        message: `未映射事件: ${hostEvent.eventType}`,
      };
    default:
      return undefined;
  }
}
