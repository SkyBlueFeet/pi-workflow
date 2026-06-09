import type { WorkflowNodeIR } from "../ir/types.js";
import type { ListOpConfig, ListOpOperation } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** ListOp 节点执行器：对输入数组执行 filter/sort/slice/map/unique 操作。 */
export class ListOpExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<ListOpConfig>;
    const operation: ListOpOperation = config.operation ?? "filter";

    const raw = context.nodeInput["items"] ?? context.nodeInput["list"] ?? context.nodeInput["input"];
    if (!Array.isArray(raw)) {
      return this.errorResult(node, `list-op 节点需要数组输入（items/list/input），实际收到: ${typeof raw}`);
    }

    try {
      const result = this.applyOperation(operation, raw, config);
      return {
        output: result,
        artifacts: [{
          type: "list-op",
          data: result,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    } catch (err) {
      return this.errorResult(node, (err as Error).message);
    }
  }

  private applyOperation(op: ListOpOperation, items: unknown[], config: Partial<ListOpConfig>): unknown[] {
    switch (op) {
      case "filter": {
        const expr = config.expression;
        if (!expr) return items;
        const fn = new Function("item", "index", `"use strict"; return (${expr});`);
        return items.filter((item, index) => fn(item, index));
      }

      case "map": {
        const expr = config.expression;
        if (!expr) return items;
        const fn = new Function("item", "index", `"use strict"; return (${expr});`);
        return items.map((item, index) => fn(item, index));
      }

      case "sort": {
        const key = config.sortKey;
        const order = config.sortOrder ?? "asc";
        const direction = order === "asc" ? 1 : -1;
        return [...items].sort((a, b) => {
          const av = key ? (a as Record<string, unknown>)[key] : a;
          const bv = key ? (b as Record<string, unknown>)[key] : b;
          if (av == null && bv == null) return 0;
          if (av == null) return direction;
          if (bv == null) return -direction;
          return av < bv ? -direction : av > bv ? direction : 0;
        });
      }

      case "slice": {
        const start = config.sliceStart ?? 0;
        const end = config.sliceEnd;
        return items.slice(start, end);
      }

      case "unique": {
        const key = config.sortKey;
        if (key) {
          const seen = new Set<unknown>();
          return items.filter(item => {
            const val = (item as Record<string, unknown>)[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
          });
        }
        return [...new Set(items)];
      }

      default:
        throw new Error(`不支持的 list-op 操作: ${op}`);
    }
  }

  private errorResult(node: WorkflowNodeIR, message: string): NodeExecutionResult {
    return {
      output: { error: message },
      artifacts: [{
        type: "list-op.error",
        data: { error: message },
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }
}
