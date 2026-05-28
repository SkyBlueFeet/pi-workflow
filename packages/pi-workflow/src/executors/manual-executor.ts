import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import { AwaitInputError } from "../runtime/errors.js";

/** 手动处理函数类型，接收输入并返回输出 */
export type ManualHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;

/** 手动节点执行器，根据 handler 和 needsInput 决定是否需要用户介入或直接处理 */
export class ManualExecutor implements WorkflowNodeExecutor {
  /**
   * @param handler - 可选的手动处理函数
   * @param needsInput - 可选，判断是否需要等待用户输入
   */
  constructor(
    private handler?: ManualHandler,
    private needsInput?: (input: Record<string, unknown>) => boolean,
  ) {}

  /**
   * 执行手动节点，若 needsInput 返回 true 则抛出 AwaitInputError 暂停流程
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   * @throws AwaitInputError 当需要用户输入时
   */
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    if (this.needsInput && this.needsInput(context.nodeInput)) {
      throw new AwaitInputError(
        `节点 ${node.id} 需要用户输入`,
        context.nodeInput,
      );
    }

    const output = this.handler
      ? await this.handler(context.nodeInput)
      : context.nodeInput;

    return {
      output,
      artifacts: [
        {
          type: "manual",
          data: output,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        },
      ],
    };
  }
}
