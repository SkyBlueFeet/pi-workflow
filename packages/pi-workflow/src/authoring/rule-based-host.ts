import { loadFromObject } from "../dsl/loader.js";
import type { WorkflowDslDocument, WorkflowDslNode } from "../dsl/types.js";
import type { WorkflowAuthoringHost, WorkflowAuthoringHostEvent, WorkflowDraftRequest, WorkflowDraftResult } from "./types.js";

export interface RuleBasedAuthoringHostOptions {
  readonly defaultId?: string;
  readonly defaultTitle?: string;
}

/**
 * 本地规则式 authoring host，用于无模型环境下把常见自然语言需求转成可 lint 的最小 DSL 草案。
 */
export class RuleBasedWorkflowAuthoringHost implements WorkflowAuthoringHost {
  constructor(private readonly options: RuleBasedAuthoringHostOptions = {}) {}

  async *generateDraft(request: WorkflowDraftRequest): AsyncGenerator<WorkflowAuthoringHostEvent, WorkflowDraftResult> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      yield { type: "error", message: "prompt 不能为空" };
      throw new Error("生成 workflow 草案失败：prompt 不能为空");
    }

    yield { type: "generating", message: "正在根据 prompt 生成本地规则草案" };

    const document = this.buildDocument(prompt, request.constraints ?? {});
    const loaded = loadFromObject(document as unknown as Record<string, unknown>);
    yield { type: "done", message: "本地规则草案已生成" };

    return {
      document: loaded.document,
      diagnostics: loaded.diagnostics,
    };
  }

  private buildDocument(prompt: string, constraints: Readonly<Record<string, unknown>>): WorkflowDslDocument {
    const id = readString(constraints.id) ?? this.options.defaultId ?? "draft-workflow";
    const title = readString(constraints.title) ?? this.options.defaultTitle ?? firstSentence(prompt);
    const nodes = buildNodes(prompt);

    return {
      id,
      version: "1.0",
      title,
      entry: nodes[0].id,
      nodes,
    };
  }
}

function buildNodes(prompt: string): WorkflowDslNode[] {
  const normalized = prompt.toLowerCase();
  const nodes: WorkflowDslNode[] = [manualNode("start", "收集输入", undefined)];
  let previousId = "start";

  if (includesAny(normalized, ["agent", "ai", "llm", "智能体", "分析", "生成", "总结"])) {
    nodes.push({
      id: "agent_step",
      title: "智能体处理",
      dependsOn: [previousId],
      executor: { type: "agent" },
      inputs: { prompt: { from: "literal", value: prompt } },
    });
    previousId = "agent_step";
  }

  if (includesAny(normalized, ["http", "api", "接口", "请求"])) {
    nodes.push({
      id: "http_step",
      title: "调用 HTTP 接口",
      dependsOn: [previousId],
      executor: { type: "http" },
      inputs: { url: { from: "literal", value: "https://example.com" } },
    });
    previousId = "http_step";
  }

  if (includesAny(normalized, ["tool", "工具"])) {
    nodes.push({
      id: "tool_step",
      title: "调用工具",
      dependsOn: [previousId],
      executor: { type: "tool" },
      inputs: { name: { from: "literal", value: "example-tool" } },
    });
    previousId = "tool_step";
  }

  nodes.push({ id: "finish", title: "返回结果", dependsOn: [previousId], executor: { type: "return" } });
  return nodes;
}

function manualNode(id: string, title: string, dependsOn?: readonly string[]): WorkflowDslNode {
  return {
    id,
    title,
    dependsOn,
    executor: { type: "manual" },
    inputs: { value: { from: "run.input" } },
  };
}

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some(term => value.includes(term));
}

function firstSentence(prompt: string): string {
  const trimmed = prompt.replace(/\s+/g, " ").trim();
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
