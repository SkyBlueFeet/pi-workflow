import type { WorkflowNodeIR } from "../ir/types.js";
import type { MergeConfig, MergeStrategy } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** Merge 节点执行器：将 if 分支的多路输出合并为单一值。 */
export class MergeExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<MergeConfig>;
    const strategy: MergeStrategy = config.strategy ?? "first-defined";

    const values = Object.values(context.nodeInput).filter(v => v !== undefined && v !== null);
    const merged = this.merge(strategy, values);

    return {
      output: merged,
      artifacts: [{
        type: "merge",
        data: merged,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }

  private merge(strategy: MergeStrategy, values: unknown[]): unknown {
    if (values.length === 0) return undefined;

    switch (strategy) {
      case "first-defined":
        return values[0];

      case "merge-object": {
        const objects = values.filter(v => v !== null && typeof v === "object" && !Array.isArray(v));
        if (objects.length === 0) return values[0];
        return Object.assign({}, ...objects);
      }

      case "concat-array": {
        const arrays = values.filter(Array.isArray);
        if (arrays.length === 0) return values;
        return ([] as unknown[]).concat(...arrays);
      }

      default:
        return values[0];
    }
  }
}
