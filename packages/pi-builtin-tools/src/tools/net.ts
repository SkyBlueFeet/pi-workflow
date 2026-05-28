import { Buffer } from "node:buffer";
import type { NetHttpMethod, NetQueryValue, NetRedirectMode, NetRequest, NetResponse, NetResponseFormat } from "../types.js";

const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const TEXT_DECODER = new TextDecoder();
const TEXT_CONTENT_TYPE_PATTERNS = [
  /^text\//i,
  /^application\/(json|xml|javascript|x-www-form-urlencoded)$/i,
  /^application\/[a-z0-9.+-]+\+(json|xml)$/i,
];

/**
 * 发起受限的 HTTP(S) 请求，返回可直接序列化的响应结果。
 *
 * 仅允许 http/https，默认拒绝回环、本地和常见私网字面量地址，
 * 避免模型借助该工具直接探测宿主机或内网服务。
 */
export async function netRequest(req: NetRequest): Promise<NetResponse> {
  const allowPrivateHosts = req.allowPrivateHosts ?? false;
  const url = buildValidatedUrl(req.url, req.query, allowPrivateHosts);
  const method = normalizeMethod(req.method);
  const timeoutSeconds = normalizeTimeoutSeconds(req.timeoutSeconds);
  const maxResponseBytes = normalizeMaxResponseBytes(req.maxResponseBytes);
  const responseFormat = req.responseFormat ?? "auto";
  const redirectMode = normalizeRedirectMode(req.redirect);
  const maxRedirects = normalizeMaxRedirects(req.maxRedirects);
  const requestHeaders = new Headers(req.headers);
  const body = prepareRequestBody(method, req, requestHeaders);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const redirectChain: string[] = [];
    let nextUrl = url;
    let response = await sendRequest(nextUrl, method, requestHeaders, body, controller.signal);

    while (isRedirectResponse(response.status)) {
      if (redirectMode === "manual") {
        break;
      }
      if (redirectMode === "error") {
        throw new Error(`Redirect not allowed for URL: ${nextUrl}`);
      }
      if (redirectChain.length >= maxRedirects) {
        throw new Error(`Too many redirects: exceeded limit ${maxRedirects}`);
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect response missing Location header: ${nextUrl}`);
      }

      nextUrl = buildValidatedRedirectUrl(nextUrl, location, allowPrivateHosts);
      redirectChain.push(nextUrl);
      response = await sendRequest(nextUrl, method, requestHeaders, body, controller.signal);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const truncated = buffer.byteLength > maxResponseBytes;
    const outputBuffer = truncated ? buffer.subarray(0, maxResponseBytes) : buffer;
    const headers = Object.fromEntries(response.headers.entries());
    const contentType = response.headers.get("content-type") ?? undefined;
    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
    const bodyEncoding = selectBodyEncoding(contentType, responseFormat);

    return {
      url,
      finalUrl: nextUrl,
      method,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers,
      body: bodyEncoding === "base64" ? outputBuffer.toString("base64") : TEXT_DECODER.decode(outputBuffer),
      bodyEncoding,
      truncated,
      contentType,
      contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
      redirected: redirectChain.length > 0,
      redirectCount: redirectChain.length,
      redirectChain,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutSeconds} seconds`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildValidatedUrl(
  rawUrl: string,
  query: Record<string, NetQueryValue> | undefined,
  allowPrivateHosts: boolean,
): string {
  const parsed = parseAndValidateUrl(rawUrl, allowPrivateHosts);
  appendQueryParams(parsed, query);
  return parsed.toString();
}

function buildValidatedRedirectUrl(fromUrl: string, location: string, allowPrivateHosts: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(location, fromUrl);
  } catch {
    throw new Error(`Invalid redirect URL: ${location}`);
  }
  return parseAndValidateUrl(parsed.toString(), allowPrivateHosts).toString();
}

function parseAndValidateUrl(rawUrl: string, allowPrivateHosts: boolean): URL {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http and https are allowed`);
  }

  if (!allowPrivateHosts && isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error(`Refusing to fetch private/loopback address: ${parsed.hostname}`);
  }

  return parsed;
}

function normalizeMethod(method: NetRequest["method"]): NetHttpMethod {
  const normalized = (method ?? "GET").toUpperCase();
  if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(normalized)) {
    return normalized as NetHttpMethod;
  }
  throw new Error(`Unsupported HTTP method: ${method}`);
}

function normalizeTimeoutSeconds(timeoutSeconds: number | undefined): number {
  const value = timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isFinite(value) || value <= 0 || value > 300) {
    throw new Error(`timeoutSeconds must be a number between 1 and 300, got: ${timeoutSeconds}`);
  }
  return value;
}

function normalizeMaxResponseBytes(maxResponseBytes: number | undefined): number {
  const value = maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isFinite(value) || value <= 0 || value > 1024 * 1024) {
    throw new Error(`maxResponseBytes must be a number between 1 and 1048576, got: ${maxResponseBytes}`);
  }
  return value;
}

function normalizeRedirectMode(redirectMode: NetRequest["redirect"]): NetRedirectMode {
  const value = redirectMode ?? "follow";
  if (value === "follow" || value === "manual" || value === "error") {
    return value;
  }
  throw new Error(`redirect must be one of: follow, manual, error. Got: ${redirectMode}`);
}

function normalizeMaxRedirects(maxRedirects: number | undefined): number {
  const value = maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  if (!Number.isFinite(value) || value < 0 || value > 20) {
    throw new Error(`maxRedirects must be a number between 0 and 20, got: ${maxRedirects}`);
  }
  return value;
}

function appendQueryParams(url: URL, query: Record<string, NetQueryValue> | undefined): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.delete(key);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      url.searchParams.append(key, String(item));
    }
  }
}

function prepareRequestBody(method: NetHttpMethod, req: NetRequest, headers: Headers): BodyInit | undefined {
  if (method === "GET" || method === "HEAD") {
    if (req.body !== undefined || req.jsonBody !== undefined || req.formData !== undefined) {
      throw new Error(`HTTP method ${method} does not allow a request body`);
    }
    return undefined;
  }

  const bodyCandidates = [req.body !== undefined, req.jsonBody !== undefined, req.formData !== undefined].filter(Boolean).length;
  if (bodyCandidates > 1) {
    throw new Error("Only one of body, jsonBody, or formData may be provided");
  }

  if (req.body !== undefined) {
    return req.body;
  }
  if (req.jsonBody !== undefined) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json; charset=utf-8");
    }
    return JSON.stringify(req.jsonBody);
  }
  if (req.formData !== undefined) {
    const form = new FormData();
    for (const [key, value] of Object.entries(req.formData)) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        form.append(key, String(item));
      }
    }
    return form;
  }
  return undefined;
}

async function sendRequest(
  url: string,
  method: NetHttpMethod,
  headers: Headers,
  body: BodyInit | undefined,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(url, {
    method,
    headers,
    body,
    signal,
    redirect: "manual",
  });
}

function isRedirectResponse(status: number): boolean {
  return status >= 300 && status < 400;
}

function selectBodyEncoding(contentType: string | undefined, responseFormat: NetResponseFormat): "text" | "base64" {
  if (responseFormat === "text") {
    return "text";
  }
  if (responseFormat === "base64") {
    return "base64";
  }
  if (contentType && TEXT_CONTENT_TYPE_PATTERNS.some((pattern) => pattern.test(contentType))) {
    return "text";
  }
  return "base64";
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
  if (isPrivateIpv4(normalized)) {
    return true;
  }
  return isPrivateIpv6(normalized);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = octets;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb");
}
