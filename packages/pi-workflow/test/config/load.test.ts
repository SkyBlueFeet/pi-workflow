import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorkflowConfigFile } from "../../src/config/load.js";

const testRoot = join(process.cwd(), "temp-config-load-test");

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe("loadWorkflowConfigFile", () => {
  it("从 .pi-workflow/settings.json 回填 packages 声明", () => {
    mkdirSync(join(testRoot, ".pi-workflow"), { recursive: true });
    writeFileSync(join(testRoot, ".pi-workflow", "settings.json"), JSON.stringify({
      packages: ["npm:@scope/demo-package@1.0.0"],
    }), "utf-8");
    writeFileSync(join(testRoot, ".pi-workflow", "pi-workflow.lock"), JSON.stringify({
      version: "1",
      packages: {
        demo: {
          alias: "demo",
          packageName: "@scope/demo-package",
          version: "1.0.0",
          source: "npm:@scope/demo-package@1.0.0",
          rootPath: "/tmp/demo",
          integrityHash: "abc123",
          executable: true,
          installedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, null, 2), "utf-8");
    const configPath = join(testRoot, "workflow.json");
    writeFileSync(configPath, JSON.stringify({ model: { provider: "openai", model: "gpt-4o-mini" } }), "utf-8");

    const loaded = loadWorkflowConfigFile(configPath, testRoot);
    expect(loaded.config.packages).toEqual({ demo: "npm:@scope/demo-package@1.0.0" });
  });

  it("显式 WorkflowConfig.packages 优先于 settings 回填", () => {
    mkdirSync(join(testRoot, ".pi-workflow"), { recursive: true });
    writeFileSync(join(testRoot, ".pi-workflow", "settings.json"), JSON.stringify({
      packages: ["npm:@scope/demo-package@1.0.0"],
    }), "utf-8");
    writeFileSync(join(testRoot, ".pi-workflow", "pi-workflow.lock"), JSON.stringify({
      version: "1",
      packages: {
        demo: {
          alias: "demo",
          packageName: "@scope/demo-package",
          version: "1.0.0",
          source: "npm:@scope/demo-package@1.0.0",
          rootPath: "/tmp/demo",
          integrityHash: "abc123",
          executable: true,
          installedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, null, 2), "utf-8");
    const configPath = join(testRoot, "workflow.json");
    writeFileSync(configPath, JSON.stringify({
      packages: {
        demo: "file:./local-demo",
        extra: "npm:extra-package",
      },
    }), "utf-8");

    const loaded = loadWorkflowConfigFile(configPath, testRoot);
    expect(loaded.config.packages).toEqual({
      demo: "file:./local-demo",
      extra: "npm:extra-package",
    });
  });
});
