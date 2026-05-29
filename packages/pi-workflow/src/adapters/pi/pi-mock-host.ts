import type { WorkflowRuntimeEvent } from "../../events/types.js";
import type {
  WorkflowPiHostCapabilities,
  WorkflowAgentRequest,
  WorkflowAgentResult,
  WorkflowHostEvent,
  WorkflowInteractionRequest,
  WorkflowInteractionResult,
} from "./types.js";
import type { CustomAgentInvokeRequest } from "../../agents/types.js";

/** 测试用 Mock PI 宿主适配器，返回预设响应而非真实模型调用。 */
export class MockPiHostAdapter implements WorkflowPiHostCapabilities {
  emitEvent?(_event: WorkflowRuntimeEvent): void | Promise<void> {}
  constructor(private responses: Map<string, string> = new Map()) {}

  async requestUserInput(_request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult> {
    return { input: { approved: false, answer: "deny" } };
  }

  /**
   * 设置指定节点 ID 的模拟返回内容。
   *
   * @param nodeId 节点 ID
   * @param content 模拟返回文本
   */
  setResponse(nodeId: string, content: string): void {
    this.responses.set(nodeId, content);
  }

  async *runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    const content = this.responses.get(request.nodeId) ?? `[Mock] Response to: ${request.prompt}`;
    yield { type: "agent.text_delta" as const, delta: content };
    return { output: content, content };
  }

  async *runNamedAgent(request: CustomAgentInvokeRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult> {
    const content = this.responses.get(request.agentId) ?? `[Mock] Response to: ${request.prompt}`;
    yield { type: "agent.text_delta" as const, delta: content };
    return { output: content, content };
  }
}
