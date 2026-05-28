import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadBuiltinToolsProjectConfig } from "../src/project-tool-config.js";

describe("loadBuiltinToolsProjectConfig", () => {
  let testRoot: string | undefined;

  afterEach(() => {
    delete process.env["BRAVE_KEY_FROM_ENV"];
    if (testRoot) {
      rmSync(testRoot, { recursive: true, force: true });
      testRoot = undefined;
    }
  });

  it("支持从 tool-config.toml 读取配置并展开环境变量", () => {
    process.env["BRAVE_KEY_FROM_ENV"] = "env-brave-key";
    testRoot = mkdtempSync(join(tmpdir(), "pi-builtin-tools-config-"));
    const configDir = join(testRoot, ".pi-workflow");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "tool-config.toml"), `
[tool."@pi-workflow/builtin-tools".webSearch]
provider = "brave"

[tool."@pi-workflow/builtin-tools".webSearch.defaults]
maxResults = 6

[tool."@pi-workflow/builtin-tools".webSearch.providers.brave]
apiKey = "\u001fENV_BRAVE_KEY\u001e"
baseUrl = "\u001fENV_BRAVE_BASE_URL\u001e"

[tool."@pi-workflow/builtin-tools".net.defaults]
timeoutSeconds = 12
redirect = "manual"
`
      .replace("\u001fENV_BRAVE_KEY\u001e", "${BRAVE_KEY_FROM_ENV}")
      .replace("\u001fENV_BRAVE_BASE_URL\u001e", "${BRAVE_BASE_URL:-https://search.example.com}"));

    expect(loadBuiltinToolsProjectConfig(testRoot)).toEqual({
      webSearch: {
        provider: "brave",
        defaults: { maxResults: 6 },
        providers: {
          brave: {
            apiKey: "env-brave-key",
            baseUrl: "https://search.example.com",
          },
        },
      },
      net: {
        defaults: {
          timeoutSeconds: 12,
          redirect: "manual",
        },
      },
    });
  });

  it("遇到非法 toml 时回退为空配置", () => {
    testRoot = mkdtempSync(join(tmpdir(), "pi-builtin-tools-config-"));
    const configDir = join(testRoot, ".pi-workflow");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "tool-config.toml"), "[tool\ninvalid = true");

    expect(loadBuiltinToolsProjectConfig(testRoot)).toEqual({});
  });
});
