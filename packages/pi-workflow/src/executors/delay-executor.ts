import type { WorkflowNodeIR } from "../ir/types.js";
import type { DelayConfig } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** Delay 节点执行器：等待指定毫秒数后继续，可被 AbortSignal 提前中断。 */
export class DelayExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<DelayConfig>;
    const delayMs = config.delayMs ?? (context.nodeInput["delayMs"] as number | undefined) ?? 0;

    const startedAt = new Date().toISOString();
    await this.sleep(delayMs, context.signal);
    const completedAt = new Date().toISOString();

    const output = { delayMs, startedAt, completedAt };
    return {
      output,
      artifacts: [{
        type: "delay",
        data: output,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("delay aborted"));
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("delay aborted"));
      }, { once: true });
    });
  }
}
