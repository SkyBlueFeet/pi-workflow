import { afterEach, describe, expect, it, vi } from "vitest";
import { HeadlessExtensionAPI } from "@pi-workflow/extension-loader";
import registerBuiltinTools from "../src/index.js";
import * as projectToolConfig from "../src/project-tool-config.js";
import { netRequest } from "../src/tools/net.js";
import { webFetch } from "../src/tools/web-fetch.js";
import { webSearch } from "../src/tools/web-search.js";

describe("netRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功发起文本请求并保留响应头", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("hello world", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-length": "11",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await netRequest({
      url: "https://example.com/api",
      method: "POST",
      body: "ping",
      headers: { "content-type": "text/plain" },
    });

    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.body).toBe("hello world");
    expect(result.bodyEncoding).toBe("text");
    expect(result.headers["content-type"]).toContain("text/plain");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api", expect.objectContaining({
      method: "POST",
      redirect: "manual",
    }));
  });

  it("在 auto 模式下对二进制响应返回 base64 并裁剪", async () => {
    const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    })));

    const result = await netRequest({
      url: "https://example.com/file.bin",
      maxResponseBytes: 4,
    });

    expect(result.bodyEncoding).toBe("base64");
    expect(result.truncated).toBe(true);
    expect(result.body).toBe(Buffer.from([0, 1, 2, 3]).toString("base64"));
  });

  it("拒绝私网和回环字面量地址", async () => {
    await expect(netRequest({ url: "http://127.0.0.1:3000/health" })).rejects.toThrow(
      "Refusing to fetch private/loopback address: 127.0.0.1",
    );
  });

  it("拒绝不支持的协议", async () => {
    await expect(netRequest({ url: "file:///tmp/test.txt" })).rejects.toThrow(
      "Unsupported protocol: file:",
    );
  });

  it("支持 query、jsonBody 和自动 content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await netRequest({
      url: "https://example.com/search?existing=1",
      method: "POST",
      query: { q: "pi", page: 2, tags: ["net", "http"] },
      jsonBody: { answer: 42 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.com/search?existing=1&q=pi&page=2&tags=net&tags=http");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.body).toBe(JSON.stringify({ answer: 42 }));
    expect(new Headers(options.headers).get("content-type")).toContain("application/json");
  });

  it("支持 multipart formData", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await netRequest({
      url: "https://example.com/form",
      method: "POST",
      formData: { a: "1", b: ["x", "y"] },
    });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.body).toBeInstanceOf(FormData);
    const values = Array.from((options.body as FormData).entries());
    expect(values).toEqual([["a", "1"], ["b", "x"], ["b", "y"]]);
  });

  it("按配置跟随重定向并记录链路", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "/next" },
      }))
      .mockResolvedValueOnce(new Response("done", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await netRequest({
      url: "https://example.com/start",
      redirect: "follow",
    });

    expect(result.finalUrl).toBe("https://example.com/next");
    expect(result.redirected).toBe(true);
    expect(result.redirectCount).toBe(1);
    expect(result.redirectChain).toEqual(["https://example.com/next"]);
  });
});

describe("builtin net tool registration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("注册 net 工具并返回错误响应", async () => {
    const api = new HeadlessExtensionAPI();
    await registerBuiltinTools(api);

    const netTool = api.tools.find((tool) => tool.name === "net");
    expect(netTool).toBeDefined();
    if (!netTool?.execute) {
      throw new Error("net tool execute handler is required");
    }

    const result = await netTool.execute(undefined, {});
    expect(result).toEqual({
      content: [{ type: "text", text: "URL is required" }],
      isError: true,
    });
  });

  it("注册 web_fetch 工具并返回 details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hello", {
      status: 200,
      headers: { "content-type": "text/plain", "content-length": "5" },
    })));

    const api = new HeadlessExtensionAPI();
    await registerBuiltinTools(api);

    const webFetchTool = api.tools.find((tool) => tool.name === "web_fetch");
    expect(webFetchTool).toBeDefined();
    if (!webFetchTool?.execute) {
      throw new Error("web_fetch execute handler is required");
    }

    const result = await webFetchTool.execute(undefined, { url: "https://example.com/plain", format: "text" }) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.content[0]?.text).toBe("hello");
    expect(result.details).toMatchObject({
      url: "https://example.com/plain",
      contentType: "text/plain",
      contentLength: 5,
      statusCode: 200,
    });
  });

  it("从项目 tool-config.toml 读取 web_search 默认 provider 与 maxResults", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      web: {
        results: [{ title: "Configured", url: "https://example.com/configured", description: "from config" }],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(projectToolConfig, "loadBuiltinToolsProjectConfig").mockReturnValue({
        webSearch: {
          provider: "brave",
          defaults: { maxResults: 7 },
          providers: {
            brave: { apiKey: "cfg-brave-key" },
          },
        },
      });

    const api = new HeadlessExtensionAPI();
    await registerBuiltinTools(api);

    const webSearchTool = api.tools.find((tool) => tool.name === "web_search");
    expect(webSearchTool).toBeDefined();
    if (!webSearchTool?.execute) {
      throw new Error("web_search execute handler is required");
    }

    await webSearchTool.execute(undefined, { query: "configured search" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.search.brave.com/res/v1/web/search?q=configured+search&count=7");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get("x-subscription-token")).toBe("cfg-brave-key");
  });

  it("从项目 tool-config.toml 读取 web_fetch 与 net 默认值", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html><body>cfg</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(projectToolConfig, "loadBuiltinToolsProjectConfig").mockReturnValue({
        webFetch: {
          defaults: { raw: true, timeout: 22, format: "markdown" },
        },
        net: {
          defaults: { timeoutSeconds: 11, redirect: "manual", responseFormat: "text" },
        },
      });

    const api = new HeadlessExtensionAPI();
    await registerBuiltinTools(api);

    const webFetchTool = api.tools.find((tool) => tool.name === "web_fetch");
    const netTool = api.tools.find((tool) => tool.name === "net");
    if (!webFetchTool?.execute || !netTool?.execute) {
      throw new Error("web_fetch and net execute handlers are required");
    }

    const webFetchResult = await webFetchTool.execute(undefined, { url: "https://example.com/page" }) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(webFetchResult.content[0]?.text).toBe("<html><body>cfg</body></html>");

    await netTool.execute(undefined, { url: "https://example.com/net" });
    const netOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(netOptions.redirect).toBe("manual");
  });
});

describe("webSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("通过 Brave provider 返回搜索结果", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      web: {
        results: [
          { title: "Pi Workflow", url: "https://example.com/pi", description: "workflow docs" },
        ],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await webSearch("pi workflow", "brave", 3, { apiKey: "brave-key" });

    expect(results).toEqual([
      { title: "Pi Workflow", url: "https://example.com/pi", snippet: "workflow docs" },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.search.brave.com/res/v1/web/search?q=pi+workflow&count=3");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get("x-subscription-token")).toBe("brave-key");
  });

  it("缺少 Brave API key 时失败", async () => {
    await expect(webSearch("pi workflow", "brave")).rejects.toThrow("BRAVE_SEARCH_API_KEY is not set");
  });

  it("通过 Serper provider 返回搜索结果", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      organic: [
        { title: "Pi Agent", link: "https://example.com/agent", snippet: "agent docs" },
      ],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await webSearch("pi agent", "serper", 4, { apiKey: "serper-key" });

    expect(results).toEqual([
      { title: "Pi Agent", url: "https://example.com/agent", snippet: "agent docs" },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://google.serper.dev/search");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ q: "pi agent", num: 4 }));
    expect(new Headers(options.headers).get("x-api-key")).toBe("serper-key");
  });

  it("缺少 Serper API key 时失败", async () => {
    await expect(webSearch("pi agent", "serper")).rejects.toThrow("SERPER_API_KEY is not set");
  });

  it("通过 Tavily provider 返回搜索结果", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { title: "Tavily Doc", url: "https://example.com/tavily", content: "search docs" },
      ],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await webSearch("tavily docs", "tavily", 2, { apiKey: "tvly-key" });

    expect(results).toEqual([
      { title: "Tavily Doc", url: "https://example.com/tavily", snippet: "search docs" },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.tavily.com/search");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({
      query: "tavily docs",
      max_results: 2,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }));
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer tvly-key");
  });

  it("缺少 Tavily API key 时失败", async () => {
    await expect(webSearch("tavily docs", "tavily")).rejects.toThrow("TAVILY_API_KEY is not set");
  });
});

describe("webFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("复用 net 请求并将 HTML 转成 markdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`
      <html>
        <head><title>Hello Page</title></head>
        <body>
          <h1>Intro</h1>
          <p>Welcome <a href="https://example.com/docs">docs</a></p>
        </body>
      </html>
    `, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })));

    const result = await webFetch({ url: "https://example.com/page", format: "markdown" });

    expect(result.url).toBe("https://example.com/page");
    expect(result.title).toBe("Hello Page");
    expect(result.details).toMatchObject({
      url: "https://example.com/page",
      title: "Hello Page",
      statusCode: 200,
    });
    expect(result.content).toContain("# Hello Page");
    expect(result.content).toContain("# Intro");
    expect(result.content).toContain("[docs](https://example.com/docs)");
  });

  it("处理相对链接、代码块、表格和图片", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`
      <html>
        <head><title>Doc</title></head>
        <body>
          <p><a href="/guide">Guide</a></p>
          <pre><code>const x = 1;</code></pre>
          <table>
            <tr><th>Name</th><th>Link</th></tr>
            <tr><td>API</td><td><a href="./api">Open</a></td></tr>
          </table>
          <img src="/cover.png" alt="Cover image">
        </body>
      </html>
    `, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })));

    const result = await webFetch({ url: "https://example.com/docs/start", format: "markdown" });

    expect(result.content).toContain("[Guide](https://example.com/guide)");
    expect(result.content).toContain("```\nconst x = 1;\n```");
    expect(result.content).toContain("| Name | Link |");
    expect(result.content).toContain("| API | [Open](https://example.com/docs/api) |");
    expect(result.content).toContain("![Cover image](https://example.com/cover.png)");
  });

  it("返回重定向和截断信息", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 301,
        headers: { location: "/final" },
      }))
      .mockResolvedValueOnce(new Response("hello", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })));

    const result = await webFetch({ url: "https://example.com/start", format: "text" });

    expect(result.url).toBe("https://example.com/final");
    expect(result.redirected).toBe(true);
    expect(result.redirectCount).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("raw 模式返回未提取的 HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html><body><h1>Raw</h1></body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })));

    const result = await webFetch({ url: "https://example.com/raw", raw: true, format: "markdown" });

    expect(result.content).toBe("<html><body><h1>Raw</h1></body></html>");
  });

  it("拒绝媒体类型响应", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fake", {
      status: 200,
      headers: { "content-type": "image/png" },
    })));

    await expect(webFetch({ url: "https://example.com/image.png" })).rejects.toThrow(
      "Unsupported content type for web_fetch: image/png",
    );
  });

  it("拒绝空文本响应", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("   ", {
      status: 200,
      headers: { "content-type": "text/plain" },
    })));

    await expect(webFetch({ url: "https://example.com/empty.txt", format: "text" })).rejects.toThrow(
      "Empty response body for URL: https://example.com/empty.txt",
    );
  });

  it("对非 2xx 响应抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", {
      status: 404,
      statusText: "Not Found",
      headers: { "content-type": "text/plain" },
    })));

    await expect(webFetch({ url: "https://example.com/missing" })).rejects.toThrow(
      "Request failed with status 404 Not Found",
    );
  });
});
