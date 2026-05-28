import type { HeadlessExtensionAPI } from "@pi-workflow/extension-loader";
import { loadBuiltinToolsProjectConfig } from "./project-tool-config.js";
import { resolveProviderConfig } from "./tool-config.js";
import { webSearch, type ProviderName } from "./tools/web-search.js";
import { webFetch } from "./tools/web-fetch.js";
import { netRequest } from "./tools/net.js";

/**
 * 注册内置工具到 PI 扩展 API。
 *
 * 扩展包加载时由 PiExtensionBridge 调用，接收无头扩展 API 实例
 * 并通过 registerTool 注册每个内置工具。
 */
export default async function (api: HeadlessExtensionAPI): Promise<void> {
  const packageConfig = loadBuiltinToolsProjectConfig();

  api.registerTool({
    name: "net",
    description: `Make a constrained HTTP(S) request.

Supports common methods, custom headers, optional request body, timeout control,
and safe response truncation. Private and loopback host literals are blocked by default.`,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The target http/https URL" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
          description: "HTTP method (default: GET)",
        },
        headers: {
          type: "object",
          description: "Optional request headers",
          additionalProperties: { type: "string" },
        },
        query: {
          type: "object",
          description: "Optional query parameters; each value may be scalar or scalar array",
        },
        body: { type: "string", description: "Optional request body for non-GET/HEAD methods" },
        jsonBody: { type: "object", description: "JSON request body; mutually exclusive with body and formData" },
        formData: { type: "object", description: "Form fields for multipart/form-data; values should be scalars or scalar arrays" },
        timeoutSeconds: { type: "number", description: "Timeout in seconds, 1-300 (default: 30)" },
        maxResponseBytes: { type: "number", description: "Maximum bytes kept from response body (default: 65536)" },
        responseFormat: {
          type: "string",
          enum: ["auto", "text", "base64"],
          description: "Response body format (default: auto)",
        },
        redirect: {
          type: "string",
          enum: ["follow", "manual", "error"],
          description: "Redirect handling mode (default: follow)",
        },
        maxRedirects: { type: "number", description: "Maximum redirects to follow, 0-20 (default: 5)" },
      },
      required: ["url"],
    },
    execute: async (_query: unknown, params: unknown) => {
      const p = params as Record<string, unknown> ?? {};
      const url = p.url as string;
      if (!url) {
        return { content: [{ type: "text", text: "URL is required" }], isError: true };
      }
      try {
        const result = await netRequest({
          url,
          method: p.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | undefined,
          headers: p.headers as Record<string, string> | undefined,
          query: p.query as Record<string, string | number | boolean | readonly (string | number | boolean)[]> | undefined,
          body: p.body as string | undefined,
          jsonBody: p.jsonBody,
          formData: p.formData as Record<string, string | number | boolean | readonly (string | number | boolean)[]> | undefined,
          timeoutSeconds: (p.timeoutSeconds as number | undefined) ?? packageConfig.net?.defaults?.timeoutSeconds,
          maxResponseBytes: (p.maxResponseBytes as number | undefined) ?? packageConfig.net?.defaults?.maxResponseBytes,
          responseFormat: (p.responseFormat as "auto" | "text" | "base64" | undefined) ?? packageConfig.net?.defaults?.responseFormat,
          redirect: (p.redirect as "follow" | "manual" | "error" | undefined) ?? packageConfig.net?.defaults?.redirect,
          maxRedirects: (p.maxRedirects as number | undefined) ?? packageConfig.net?.defaults?.maxRedirects,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
    },
  });

  api.registerTool({
    name: "web_search",
    description: `Search the web using a configurable search provider.

Returns a list of search results with title, URL, and snippet for each match.

Supported providers: brave, tavily, serper, exa

Requires the provider's API key in the package configuration.`,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query string" },
        provider: {
          type: "string",
          enum: ["brave", "tavily", "serper", "exa"],
          description: "Search provider to use (default: brave)",
        },
        maxResults: { type: "number", description: "Maximum number of results to return (default: 10)" },
      },
      required: ["query"],
    },
    execute: async (query: unknown, params: unknown) => {
      const p = params as Record<string, unknown> ?? {};
      const q = (p.query ?? query) as string;
      if (!q) {
        return { content: [{ type: "text", text: "Query is required" }], isError: true };
      }
      try {
        const provider = (p.provider as ProviderName | undefined) ?? packageConfig.webSearch?.provider ?? "brave";
        const results = await webSearch(
          q,
          provider,
          (p.maxResults as number | undefined) ?? packageConfig.webSearch?.defaults?.maxResults,
          resolveProviderConfig(packageConfig, provider),
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
          details: {
            query: q,
            backend: provider,
            resultCount: results.length,
            results,
          },
        };
      } catch (err) {
        return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
    },
  });

  api.registerTool({
    name: "web_fetch",
    description: `Fetch and extract content from a given URL.

Returns the page content converted to the requested format (markdown, text, or html).
Set raw=true to return the unprocessed response body.`,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        raw: { type: "boolean", description: "Return the raw response body without HTML extraction" },
        format: {
          type: "string",
          enum: ["markdown", "text", "html"],
          description: "Output format (default: markdown)",
        },
        timeout: { type: "number", description: "Timeout in seconds (default: 30)" },
      },
      required: ["url"],
    },
    execute: async (_query: unknown, params: unknown) => {
      const p = params as Record<string, unknown> ?? {};
      const url = p.url as string;
      if (!url) {
        return { content: [{ type: "text", text: "URL is required" }], isError: true };
      }
      try {
        const result = await webFetch({
          url,
          format: (p.format as "markdown" | "text" | "html") ?? packageConfig.webFetch?.defaults?.format ?? "markdown",
          timeout: (p.timeout as number | undefined) ?? packageConfig.webFetch?.defaults?.timeout,
          raw: (p.raw as boolean | undefined) ?? packageConfig.webFetch?.defaults?.raw ?? false,
        });
        return { content: [{ type: "text", text: result.content }], details: result.details };
      } catch (err) {
        return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
    },
  });
}
