import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PiExtensionBridge } from "../src/pi-extension-bridge.js";

const testRoot = join(process.cwd(), "temp-pi-extension-bridge-test");
const originalCwd = process.cwd();

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(join(testRoot, "node_modules", "@scope", "pkg-ext"), { recursive: true });
  mkdirSync(join(testRoot, "node_modules", "plain-pkg"), { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(testRoot, { recursive: true, force: true });
});

describe("PiExtensionBridge", () => {
  it("扫描 node_modules 中声明 pi.extensions 的包", async () => {
    writeFileSync(join(testRoot, "node_modules", "@scope", "pkg-ext", "package.json"), JSON.stringify({
      name: "@scope/pkg-ext",
      pi: { extensions: ["dist/index.js"] },
    }), "utf-8");
    writeFileSync(join(testRoot, "node_modules", "plain-pkg", "package.json"), JSON.stringify({
      name: "plain-pkg",
    }), "utf-8");

    process.chdir(testRoot);
    const bridge = new PiExtensionBridge() as any;
    const packages = await bridge.scanNodeModules();

    expect(packages).toEqual(["@scope/pkg-ext"]);
  });
});
