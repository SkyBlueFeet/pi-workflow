export interface ToolProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface BuiltinToolsPackageConfig {
  webSearch?: {
    provider?: "brave" | "tavily" | "serper" | "exa";
    defaults?: {
      maxResults?: number;
    };
    providers?: Partial<Record<"brave" | "tavily" | "serper" | "exa", ToolProviderConfig>>;
  };
  webFetch?: {
    defaults?: {
      timeout?: number;
      raw?: boolean;
      format?: "markdown" | "text" | "html";
    };
  };
  net?: {
    defaults?: {
      timeoutSeconds?: number;
      maxResponseBytes?: number;
      responseFormat?: NetResponseFormat;
      redirect?: NetRedirectMode;
      maxRedirects?: number;
    };
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebFetchDetails {
  url: string;
  title?: string;
  contentType?: string;
  contentLength?: number;
  statusCode?: number;
  truncated?: boolean;
  redirected?: boolean;
  redirectCount?: number;
}

export interface WebFetchResult {
  url: string;
  content: string;
  title?: string;
  contentType?: string;
  statusCode?: number;
  truncated?: boolean;
  redirected?: boolean;
  redirectCount?: number;
  details: WebFetchDetails;
}

export type NetHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type NetResponseFormat = "auto" | "text" | "base64";

export type NetRedirectMode = "follow" | "manual" | "error";

export type NetScalarValue = string | number | boolean;

export type NetQueryValue = NetScalarValue | readonly NetScalarValue[];

export interface NetRequest {
  url: string;
  method?: NetHttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, NetQueryValue>;
  body?: string;
  jsonBody?: unknown;
  formData?: Record<string, NetScalarValue | readonly NetScalarValue[]>;
  timeoutSeconds?: number;
  maxResponseBytes?: number;
  responseFormat?: NetResponseFormat;
  redirect?: NetRedirectMode;
  maxRedirects?: number;
  allowPrivateHosts?: boolean;
}

export interface NetResponse {
  url: string;
  finalUrl: string;
  method: NetHttpMethod;
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: "text" | "base64";
  truncated: boolean;
  contentType?: string;
  contentLength?: number;
  redirected: boolean;
  redirectCount: number;
  redirectChain: string[];
}
