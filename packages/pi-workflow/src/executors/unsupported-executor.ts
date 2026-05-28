import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** 不支持的节点类型执行器（回退执行器），直接抛出错误 */
export class UnsupportedExecutor implements WorkflowNodeExecutor {
  /**
   * 抛出不支持错误
   * @param node - 工作流节点 IR
   * @throws 始终抛出，提示该节点类型未注册 executor
   */
  async execute(node: WorkflowNodeIR, _context: ExecutionContext): Promise<NodeExecutionResult> {
    throw new Error(`不支持的节点类型: ${node.kind}（节点 ${node.id}），该类型尚未接入 executor`);
  }
}
