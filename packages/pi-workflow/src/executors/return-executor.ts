import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** Return 节点执行器，将输入直接作为输出返回，用于显式工作流返回 */
export class ReturnExecutor implements WorkflowNodeExecutor {
  /**
   * 执行 return 节点，将 nodeInput 作为输出返回
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   */
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    return {
      output: context.nodeInput,
      artifacts: [
        {
          type: "return",
          data: context.nodeInput,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        },
      ],
    };
  }
}
