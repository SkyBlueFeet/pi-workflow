import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPackageSkill } from "../../../src/adapters/pi/package-resource-loader.js";
import { buildExtensionCatalog } from "../../../src/adapters/pi/extension-catalog.js";
import type { ResolvedPackage } from "../../../src/config/package-resolver.js";

const testRoot = join(process.cwd(), "temp-package-resource-loader-test");

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe("package resource loader", () => {
  it("优先使用已安装包 rootPath 加载 skill 资源", () => {
    const installedRoot = join(testRoot, ".pi-workflow", "packages", "demo");
    mkdirSync(join(installedRoot, "skills", "writer"), { recursive: true });
    writeFileSync(join(installedRoot, "skills", "writer", "SKILL.md"), "# writer", "utf-8");

    const pkg: ResolvedPackage = {
      declaration: { alias: "demo", source: { type: "npm", spec: "demo" }, enabled: true },
      installed: true,
      rootPath: installedRoot,
      manifest: { skills: ["skills/writer"] },
      resourceAccessAllowed: true,
      executableAllowed: false,
    };

    const skill = loadPackageSkill(pkg, "writer");
    expect(skill?.content).toBe("# writer");
  });

  it("扩展目录扫描使用已安装包 rootPath", () => {
    const installedRoot = join(testRoot, ".pi-workflow", "packages", "demo");
    mkdirSync(join(installedRoot, "dist"), { recursive: true });
    writeFileSync(join(installedRoot, "dist", "tool.js"), "export default {}", "utf-8");

    const pkg: ResolvedPackage = {
      declaration: { alias: "demo", source: { type: "npm", spec: "demo" }, enabled: true },
      installed: true,
      rootPath: installedRoot,
      manifest: { extensions: ["dist/tool.js"] },
      resourceAccessAllowed: true,
      executableAllowed: true,
    };

    const catalog = buildExtensionCatalog([pkg]);
    expect(catalog[0]?.executable).toBe(true);
  });
});
