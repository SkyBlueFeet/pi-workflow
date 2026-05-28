import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredWorkflowPackages,
  getInstalledPackageInfo,
  installPackageWithPi,
  listInstalledPackages,
  parsePackageSource,
  uninstallPackageWithPi,
} from "../src/pi-package-adapter.js";

const testRoot = join(process.cwd(), "temp-pi-package-adapter-test");

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe("pi package adapter", () => {
  it("安装本地包后写入锁文件并可查询", async () => {
    const sourceDir = join(testRoot, "source");
    mkdirSync(join(sourceDir, "skills", "writer"), { recursive: true });
    writeFileSync(join(sourceDir, "package.json"), JSON.stringify({
      name: "demo-package",
      version: "1.2.3",
      pi: {
        skills: ["skills/writer"],
      },
    }), "utf-8");
    writeFileSync(join(sourceDir, "skills", "writer", "SKILL.md"), "# writer", "utf-8");

    const result = await installPackageWithPi({
      alias: "demo",
      source: { type: "file", spec: `file:${sourceDir}`, path: sourceDir },
    }, testRoot);

    expect(result.existing).toBe(false);
    expect(result.record.packageName).toBe("demo-package");
    expect(result.record.version).toBe("1.2.3");
    expect(result.record.rootPath).toBe(sourceDir);
    expect(result.record.executable).toBe(true);

    const info = getInstalledPackageInfo("demo", testRoot);
    expect(info?.record.source).toBe(`file:${sourceDir}`);
    expect(info?.resourceAccessAllowed).toBe(true);

    const packages = listInstalledPackages(testRoot);
    expect(packages).toHaveLength(1);
    expect(packages[0]?.record.alias).toBe("demo");
  });

  it("卸载本地包时删除锁文件记录", async () => {
    const sourceDir = join(testRoot, "source");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "package.json"), JSON.stringify({ name: "demo-package", version: "1.0.0" }), "utf-8");

    await installPackageWithPi({
      alias: "demo",
      source: { type: "file", spec: `file:${sourceDir}`, path: sourceDir },
    }, testRoot);

    expect(await uninstallPackageWithPi("demo", testRoot)).toBe(true);
    expect(getInstalledPackageInfo("demo", testRoot)).toBeUndefined();
  });

  it("解析 git 源时保留 ref 信息", () => {
    expect(parsePackageSource("git:https://github.com/example/repo.git#main")).toEqual({
      type: "git",
      url: "https://github.com/example/repo.git",
      ref: "main",
      spec: "git:https://github.com/example/repo.git#main",
    });
  });

  it("从 settings 与锁文件映射 workflow packages", async () => {
    const sourceDir = join(testRoot, "source");
    mkdirSync(join(testRoot, ".pi-workflow"), { recursive: true });
    writeFileSync(join(testRoot, ".pi-workflow", "settings.json"), JSON.stringify({
      packages: [sourceDir],
    }), "utf-8");
    writeFileSync(join(testRoot, ".pi-workflow", "pi-workflow.lock"), JSON.stringify({
      version: "1",
      packages: {
        demo: {
          alias: "demo",
          packageName: "demo-package",
          version: "1.0.0",
          source: `file:${sourceDir}`,
          rootPath: sourceDir,
          integrityHash: "abc123",
          executable: true,
          installedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, null, 2), "utf-8");

    expect(getConfiguredWorkflowPackages(testRoot)).toEqual({
      demo: `file:${sourceDir}`,
    });
  });
});
