import vm from "node:vm";
import type { WorkflowNodeIR } from "../ir/types.js";
import type { CodeConfig } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

const DEFAULT_TIMEOUT_MS = 3000;

/** Code 节点执行器：在 Node.js vm 沙箱中执行 JavaScript 脚本，通过 return 返回结果。
 *
 * 脚本内可访问的变量：
 *   - `input`：节点的 nodeInput（已解析的输入绑定）
 *   - `context`：工作流 sharedContext（只读引用）
 *
 * 示例脚本：
 *   return input.items.map(item => item.name).join(", ");
 */
export class CodeExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<CodeConfig>;
    const script = config.script ?? (context.nodeInput["script"] as string | undefined) ?? "";
    const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS;

    if (!script.trim()) {
      return this.errorResult(node, "code 节点缺少 script 配置");
    }

    // 将 script 包装为函数体，支持 return 语法
    const wrappedCode = `(function() { ${script} })()`;

    const sandbox = vm.createContext({
      input: context.nodeInput,
      context: context.sharedContext,
      console: { log: () => {}, warn: () => {}, error: () => {} },
    });

    let output: unknown;
    try {
      output = vm.runInContext(wrappedCode, sandbox, { timeout: timeoutMs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.errorResult(node, `脚本执行失败: ${msg}`);
    }

    return {
      output,
      artifacts: [{
        type: "code",
        data: output,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }

  private errorResult(node: WorkflowNodeIR, message: string): NodeExecutionResult {
    return {
      output: { error: message },
      artifacts: [{
        type: "code.error",
        data: { error: message },
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }
}
