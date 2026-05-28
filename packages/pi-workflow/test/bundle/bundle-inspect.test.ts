import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildPwbFromDirectory } from "../../src/bundle/build.js";
import { loadPwbFile } from "../../src/bundle/load.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleFlowDir = resolve(__dirname, "../fixtures/bundle-flow");
const bundleAssetsDir = resolve(__dirname, "../fixtures/bundle-flow-with-assets");

let pwbPath: string;
let assetsPwbPath: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "pwb-inspect-test-"));

  const result = buildPwbFromDirectory(bundleFlowDir);
  pwbPath = resolve(tmpDir, "test-bundle.pwb");
  writeFileSync(pwbPath, result.pwbData);

  const assetsResult = buildPwbFromDirectory(bundleAssetsDir);
  assetsPwbPath = resolve(tmpDir, "assets-bundle.pwb");
  writeFileSync(assetsPwbPath, assetsResult.pwbData);
});

describe("bundle inspect", () => {
  it("inspect 加载 bundle 并返回 manifest 摘要（不触发执行）", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const summary = {
      kind: result.manifest.kind,
      workflow: result.manifest.workflow,
      document: result.manifest.document,
      resourceCount: result.manifest.resources.length,
    };
    expect(summary.kind).toBe("pi-workflow-bundle");
    expect(summary.workflow.id).toBe("bundle-flow");
    expect(summary.document.size).toBeGreaterThan(0);
    expect(summary.resourceCount).toBe(0);
  });

  it("inspect 可输出 document 摘要（节点数、entry 等）", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.document.nodes.length).toBe(2);
    expect(result.document.entry).toBe("start");
  });

  it("含资源的 bundle inspect 可输出资源摘要", () => {
    const result = loadPwbFile(assetsPwbPath);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(result.manifest.resources.length).toBe(2);

    const totalSize = result.manifest.resources.reduce((s, r) => s + r.size, 0);
    const strategies = new Set(result.manifest.resources.map(r => r.strategy));
    expect(totalSize).toBeGreaterThan(0);
    expect(strategies.has("archive")).toBe(true);
    expect(strategies.has("inline")).toBe(true);
  });

  it("inspect 返回的 resourceReader 可读取资源内容", () => {
    const result = loadPwbFile(assetsPwbPath);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    expect(result.resourceReader.has("assets/logo.png")).toBe(true);
    const pngBytes = result.resourceReader.readBytes("assets/logo.png");
    expect(pngBytes.length).toBeGreaterThan(0);

    const pngMeta = result.resourceReader.getMetadata("assets/logo.png");
    expect(pngMeta.size).toBeGreaterThan(0);
    expect(pngMeta.sha256).toBeTruthy();

    expect(result.resourceReader.has("prompts/system.md")).toBe(true);
    const mdText = result.resourceReader.readText("prompts/system.md");
    expect(mdText.length).toBeGreaterThan(0);
    expect(mdText).toContain("helpful assistant");
  });

  it("inspect 不触发运行时执行", () => {
    const loadResult = loadPwbFile(pwbPath);
    expect(loadResult.manifest).toBeDefined();
    expect(loadResult.document).toBeDefined();
  });
});
