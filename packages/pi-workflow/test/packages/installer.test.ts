import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getPackageInfo, installPackage, uninstallPackage } from "../../src/packages/installer.js";

const testRoot = join(process.cwd(), "temp-installer-test");

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe("package installer", () => {
  it("卸载时删除 lock 记录和缓存目录", async () => {
    mkdirSync(testRoot, { recursive: true });
    const sourceDir = join(testRoot, "source");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }), "utf-8");

    await installPackage({ alias: "demo", source: { type: "file", spec: `file:${sourceDir}`, path: sourceDir } }, testRoot);
    const info = getPackageInfo("demo", testRoot);
    expect(info?.record.packageName).toBe("demo");
    expect(info?.record.rootPath).toBe(sourceDir);

    expect(await uninstallPackage("demo", testRoot)).toBe(true);
    expect(getPackageInfo("demo", testRoot)).toBeUndefined();
  });
});
