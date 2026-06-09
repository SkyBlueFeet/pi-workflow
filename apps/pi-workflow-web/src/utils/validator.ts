import {
  validateSchema,
} from "../../../../packages/pi-workflow/src/dsl/schema.js";
import {
  validateReferences,
} from "../../../../packages/pi-workflow/src/dsl/validator.js";
import type {
  WorkflowDiagnostic,
} from "../../../../packages/pi-workflow/src/ir/diagnostics.js";
import type { GraphModel } from "../types/graph.js";
import { graphToDsl } from "../types/dsl-bridge.js";

function collectDslDiagnostics(model: GraphModel): readonly WorkflowDiagnostic[] {
  const doc = graphToDsl(model);
  return [
    ...validateSchema(doc),
    ...validateReferences(doc),
  ];
}

/**
 * 对当前图模型运行 core DSL 校验，并把诊断挂到节点上。
 */
export function validateGraphModel(model: GraphModel): GraphModel {
  const errorsByNode = new Map<string, string[]>();
  for (const node of model.nodes) {
    errorsByNode.set(node.id, []);
  }

  try {
    const diags = collectDslDiagnostics(model);

    for (const d of diags) {
      if (d.nodeId && errorsByNode.has(d.nodeId)) {
        errorsByNode.get(d.nodeId)!.push(`[${d.severity}] ${d.code}: ${d.message}`);
      }
    }
  } catch {
    // DSL 序列化失败时不阻塞编辑
  }

  return {
    ...model,
    nodes: model.nodes.map(node => ({
      ...node,
      data: { ...node.data, errors: errorsByNode.get(node.id) ?? [] },
    })),
  };
}

/**
 * 混合校验：先做前端补充校验，再叠加 core DSL validator 结果。
 */
export function quickValidate(model: GraphModel): GraphModel {
  const withLocalErrors = {
    ...model,
    nodes: model.nodes.map(node => {
      const errors: string[] = [];

      if (!node.data.title.trim()) {
        errors.push("标题不能为空");
      }

      // agent 节点必须有 system_prompt 或 user_prompt
      if (node.type === "agent") {
        const sp = node.data.inputs["system_prompt"];
        const up = node.data.inputs["user_prompt"];
        if (!sp || (sp.from === "literal" && !sp.value)) {
          if (!up || (up.from === "literal" && !up.value)) {
            errors.push("agent 节点需要 system_prompt 或 user_prompt");
          }
        }
      }

      // http 节点必须有 url
      if (node.type === "http") {
        const url = node.data.inputs["url"];
        if (!url || (url.from === "literal" && !url.value)) {
          errors.push("http 节点需要 url");
        }
      }

      // tool 节点必须有 toolName
      if (node.type === "tool") {
        const toolName = node.data.inputs["toolName"];
        if (!toolName || (toolName.from === "literal" && !toolName.value)) {
          errors.push("tool 节点需要 toolName");
        }
      }

      // entry 节点检查
      if (model.entryNodeId === node.id) {
        // entry 节点无特殊限制
      }

      return { ...node, data: { ...node.data, errors } };
    }),
  };

  const validated = validateGraphModel(withLocalErrors);
  return {
    ...validated,
    nodes: validated.nodes.map((node, index) => ({
      ...node,
      data: {
        ...node.data,
        errors: [
          ...withLocalErrors.nodes[index].data.errors,
          ...node.data.errors,
        ],
      },
    })),
  };
}
