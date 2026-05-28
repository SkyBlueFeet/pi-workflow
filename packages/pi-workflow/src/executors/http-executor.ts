import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** HTTP 请求配置 */
export interface HttpRequestConfig {
  /** 请求 URL（必填） */
  readonly url: string;
  /** HTTP 方法，默认 GET */
  readonly method?: string;
  /** 请求头 */
  readonly headers?: Record<string, string>;
  /** 请求体 */
  readonly body?: unknown;
  /** 超时毫秒数，默认 30000 */
  readonly timeoutMs?: number;
}

/** HTTP 节点执行器，发送 HTTP 请求并返回响应状态、头和体 */
export class HttpExecutor implements WorkflowNodeExecutor {
  /**
   * 执行 HTTP 请求
   * @param node - 工作流节点 IR
   * @param context - 执行上下文（nodeInput 中包含 url、method、headers、body、timeoutMs）
   */
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = context.nodeInput as Record<string, unknown>;
    const url = config["url"] as string ?? "";
    if (!url) {
      return {
        output: { error: "http 节点缺少 url 参数" },
        artifacts: [{
          type: "http.error",
          data: { error: "missing url" },
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    }

    const method = (config["method"] as string) ?? "GET";
    const headers = (config["headers"] as Record<string, string>) ?? {};
    const body = config["body"];
    const timeoutMs = (config["timeoutMs"] as number) ?? 30000;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      context.signal?.addEventListener("abort", () => controller.abort(), { once: true });

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: { "content-type": "application/json", ...headers },
        signal: controller.signal,
      };

      if (body && method.toUpperCase() !== "GET") {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timer);

      let responseBody: unknown;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };

      return {
        output: result,
        artifacts: [{
          type: "http",
          data: result,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        output: { error: msg },
        artifacts: [{
          type: "http.error",
          data: { error: msg },
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        }],
      };
    }
  }
}
