import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowPiHostCapabilities } from "../adapters/pi/types.js";

/** 工具函数类型，接收参数并返回执行结果 */
export type ToolFunction = (params: Record<string, unknown>) => unknown | Promise<unknown>;

/** 工具节点执行器，支持本地注册的工具函数和 PI host 的 callTool 能力 */
export class ToolExecutor implements WorkflowNodeExecutor {
  private tools = new Map<string, ToolFunction>();

  /** 注册本地工具函数 */
  register(name: string, fn: ToolFunction): void {
    this.tools.set(name, fn);
  }

  /**
   * 执行工具节点，优先查找本地注册的工具，其次通过 PI host 的 callTool 调用
   * @param node - 工作流节点 IR
   * @param context - 执行上下文（nodeInput 需包含 toolName/name 和 params/parameters）
   */
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const toolName = context.nodeInput["toolName"] as string
      ?? context.nodeInput["name"] as string
      ?? "";
    const params = context.nodeInput["params"] as Record<string, unknown>
      ?? context.nodeInput["parameters"] as Record<string, unknown>
      ?? {};

    if (!toolName) {
      return {
        output: { error: "tool 节点缺少 toolName 或 name 参数" },
        artifacts: [{
          type: "tool.error",
          data: { error: "missing toolName" },
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    }

    const localTool = this.tools.get(toolName);
    if (localTool) {
      const result = await localTool(params);
      return {
        output: result,
        artifacts: [{
          type: "tool",
          data: result,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    }

    const piHost = context.host as WorkflowPiHostCapabilities;
    if (piHost.callTool) {
      const result = await piHost.callTool({
        nodeId: node.id,
        toolName,
        params,
      });
      return {
        output: result,
        artifacts: [{
          type: "tool",
          data: result,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    }

    return {
      output: { error: `未找到 tool: ${toolName}，且当前 host 不支持 callTool` },
      artifacts: [{
        type: "tool.error",
        data: { error: `unsupported tool: ${toolName}` },
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }
}
