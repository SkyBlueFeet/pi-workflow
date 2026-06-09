import type { WorkflowNodeIR } from "../ir/types.js";
import type { TemplateConfig } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** Template 节点执行器：用 context.nodeInput 替换模板中的 {{key}} 或 {{nested.path}} 占位符。 */
export class TemplateExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = (node.executor?.config ?? {}) as Partial<TemplateConfig>;
    const template = config.template ?? (context.nodeInput["template"] as string | undefined) ?? "";

    if (!template) {
      return this.result(node, "", { warning: "template 为空" });
    }

    const rendered = template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
      const val = this.resolvePath(context.nodeInput, path);
      return val == null ? "" : String(val);
    });

    return this.result(node, rendered);
  }

  private resolvePath(obj: Readonly<Record<string, unknown>>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private result(node: WorkflowNodeIR, output: string, meta?: Record<string, unknown>): NodeExecutionResult {
    return {
      output: meta ? { value: output, ...meta } : output,
      artifacts: [{
        type: "template",
        data: output,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }
}
