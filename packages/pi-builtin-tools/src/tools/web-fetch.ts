import type { WebFetchResult } from "../types.js";
import { extractHtmlTitle, formatHtmlContent } from "./html-extractor.js";
import { netRequest } from "./net.js";

export interface FetchRequest {
  url: string;
  format?: "markdown" | "text" | "html";
  timeout?: number;
  raw?: boolean;
}

/**
 * 抓取 URL 并返回基础提取后的网页内容。
 *
 * 当前实现优先覆盖常见文本与 HTML 页面，不引入重型解析依赖，
 * 先为后续 provider 化与更强提取策略提供稳定入口。
 */
export async function webFetch(req: FetchRequest): Promise<WebFetchResult> {
  const format = req.format ?? "markdown";
  const raw = req.raw ?? false;
  const response = await netRequest({
    url: req.url,
    timeoutSeconds: req.timeout,
    responseFormat: "text",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} ${response.statusText}`.trim());
  }
  if (response.bodyEncoding !== "text") {
    throw new Error(`Unsupported response encoding for web_fetch: ${response.bodyEncoding}`);
  }

  const contentType = response.contentType ?? "";
  if (/^(image|video|audio)\//i.test(contentType)) {
    throw new Error(`Unsupported content type for web_fetch: ${contentType}`);
  }
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);
  const title = isHtml ? extractHtmlTitle(response.body) : undefined;
  const content = raw
    ? response.body
    : isHtml
    ? formatHtmlContent(response.body, format, response.finalUrl)
    : formatTextContent(response.body, format);

  if (!content) {
    throw new Error(`Empty response body for URL: ${response.finalUrl}`);
  }

  return {
    url: response.finalUrl,
    content,
    title,
    contentType: response.contentType,
    statusCode: response.status,
    truncated: response.truncated,
    redirected: response.redirected,
    redirectCount: response.redirectCount,
    details: {
      url: response.finalUrl,
      title,
      contentType: response.contentType,
      contentLength: response.contentLength,
      statusCode: response.status,
      truncated: response.truncated,
      redirected: response.redirected,
      redirectCount: response.redirectCount,
    },
  };
}

function formatTextContent(text: string, format: FetchRequest["format"]): string {
  if (format === "html") {
    return text;
  }
  return normalizeWhitespace(text);
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
