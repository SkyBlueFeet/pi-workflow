import type { ToolProviderConfig, SearchResult } from "../types.js";
import { netRequest } from "./net.js";

export type ProviderName = "brave" | "tavily" | "serper" | "exa";

interface SearchRequest {
  query: string;
  maxResults?: number;
}

interface ProviderAdapter {
  name: ProviderName;
  search(req: SearchRequest, config: ToolProviderConfig): Promise<SearchResult[]>;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
}

interface SerperSearchResponse {
  organic?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

const adapters: Record<ProviderName, ProviderAdapter> = {
  brave: {
    name: "brave",
    async search(req, config) {
      const apiKey = config.apiKey ?? process.env["BRAVE_SEARCH_API_KEY"];
      if (!apiKey) {
        throw new Error("BRAVE_SEARCH_API_KEY is not set");
      }

      const response = await netRequest({
        url: config.baseUrl ?? process.env["BRAVE_SEARCH_BASE_URL"] ?? "https://api.search.brave.com/res/v1/web/search",
        query: {
          q: req.query,
          count: normalizeMaxResults(req.maxResults),
        },
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        responseFormat: "text",
      });
      if (!response.ok) {
        throw new Error(`Brave search request failed with status ${response.status} ${response.statusText}`.trim());
      }

      let payload: BraveSearchResponse;
      try {
        payload = JSON.parse(response.body) as BraveSearchResponse;
      } catch (error) {
        throw new Error("Brave search response is not valid JSON", { cause: error });
      }

      return (payload.web?.results ?? [])
        .filter((item) => item.title && item.url)
        .map((item) => ({
          title: item.title ?? "",
          url: item.url ?? "",
          snippet: item.description ?? "",
        }));
    },
  },
  tavily: {
    name: "tavily",
    async search(req, config) {
      const apiKey = config.apiKey ?? process.env["TAVILY_API_KEY"];
      if (!apiKey) {
        throw new Error("TAVILY_API_KEY is not set");
      }

      const response = await netRequest({
        url: config.baseUrl ?? process.env["TAVILY_BASE_URL"] ?? "https://api.tavily.com/search",
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        jsonBody: {
          query: req.query,
          max_results: normalizeMaxResults(req.maxResults),
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        },
        responseFormat: "text",
      });
      if (!response.ok) {
        throw new Error(`Tavily search request failed with status ${response.status} ${response.statusText}`.trim());
      }

      let payload: TavilySearchResponse;
      try {
        payload = JSON.parse(response.body) as TavilySearchResponse;
      } catch (error) {
        throw new Error("Tavily search response is not valid JSON", { cause: error });
      }

      return (payload.results ?? [])
        .filter((item) => item.title && item.url)
        .map((item) => ({
          title: item.title ?? "",
          url: item.url ?? "",
          snippet: item.content ?? "",
        }));
    },
  },
  serper: {
    name: "serper",
    async search(req, config) {
      const apiKey = config.apiKey ?? process.env["SERPER_API_KEY"];
      if (!apiKey) {
        throw new Error("SERPER_API_KEY is not set");
      }

      const response = await netRequest({
        url: config.baseUrl ?? process.env["SERPER_BASE_URL"] ?? "https://google.serper.dev/search",
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        jsonBody: {
          q: req.query,
          num: normalizeMaxResults(req.maxResults),
        },
        responseFormat: "text",
      });
      if (!response.ok) {
        throw new Error(`Serper search request failed with status ${response.status} ${response.statusText}`.trim());
      }

      let payload: SerperSearchResponse;
      try {
        payload = JSON.parse(response.body) as SerperSearchResponse;
      } catch (error) {
        throw new Error("Serper search response is not valid JSON", { cause: error });
      }

      return (payload.organic ?? [])
        .filter((item) => item.title && item.link)
        .map((item) => ({
          title: item.title ?? "",
          url: item.link ?? "",
          snippet: item.snippet ?? "",
        }));
    },
  },
  exa: {
    name: "exa",
    async search(_req, _config) {
      throw new Error("Exa search provider not yet implemented");
    },
  },
};

export async function webSearch(
  query: string,
  provider: ProviderName = "brave",
  maxResults?: number,
  config?: ToolProviderConfig,
): Promise<SearchResult[]> {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unknown search provider: ${provider}. Supported: ${Object.keys(adapters).join(", ")}`);
  }
  return adapter.search({ query, maxResults }, config ?? {});
}

function normalizeMaxResults(maxResults: number | undefined): number {
  const value = maxResults ?? 10;
  if (!Number.isFinite(value) || value < 1 || value > 20) {
    throw new Error(`maxResults must be a number between 1 and 20, got: ${maxResults}`);
  }
  return Math.floor(value);
}
