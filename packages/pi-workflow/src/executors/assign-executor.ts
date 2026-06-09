import type { WorkflowNodeIR } from "../ir/types.js";
import type { AssignConfig } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult, WorkflowArtifact } from "../artifacts/types.js";

/** Assign 节点执行器：将多个输入值显式写入 sharedContext 的指定路径。 */
export class AssignExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<AssignConfig>;
    const assignments = config.assignments ?? [];

    if (assignments.length === 0) {
      return {
        output: { assigned: 0, warning: "assignments 为空" },
        artifacts: [],
      };
    }

    const artifacts: WorkflowArtifact[] = [];
    const assigned: Record<string, unknown> = {};

    for (const entry of assignments) {
      const value = context.nodeInput[entry.key];
      assigned[entry.to] = value;
      artifacts.push({
        type: "assign",
        data: value,
        targetPath: entry.to,
        mergeStrategy: entry.mergeStrategy ?? "replace",
      });
    }

    return {
      output: { assigned: assignments.length, values: assigned },
      artifacts,
    };
  }
}
