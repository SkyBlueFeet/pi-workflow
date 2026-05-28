import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import { buildPwbFromDirectory } from "../../src/bundle/build.js";
import { readZip, listZipEntries } from "../../src/bundle/zip-util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleFlowDir = resolve(__dirname, "../fixtures/bundle-flow");
const bundleAssetsDir = resolve(__dirname, "../fixtures/bundle-flow-with-assets");

describe("buildPwbFromDirectory", () => {
  it("将最小 workflow 构建为有效的 .pwb bundle", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(result.manifest.kind).toBe("pi-workflow-bundle");
    expect(result.manifest.bundleVersion).toBe("1");
    expect(result.manifest.workflow.id).toBe("bundle-flow");
    expect(result.manifest.resources).toHaveLength(0);
    expect(result.manifest.configSnapshot.included).toBe(false);
    expect(result.pwbData.length).toBeGreaterThan(0);
  });

  it("构建时包含 document.json 和 manifest.json", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    const entries = listZipEntries(result.pwbData);
    expect(entries).toContain("manifest.json");
    expect(entries).toContain("document.json");
  });

  it("manifest 包含 source、document 和资源的元数据", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(result.manifest.source.type).toBe("directory");
    expect(result.manifest.source.entry).toBe("flow.json");
    expect(result.manifest.source.builtAt).toBeTruthy();
    expect(result.manifest.document.path).toBe("document.json");
    expect(result.manifest.document.sha256).toBeTruthy();
    expect(result.manifest.document.size).toBeGreaterThan(0);
  });

  it("manifest 包含 configSnapshot.included = false 和 signature 预留字段", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    expect(result.manifest.configSnapshot).toEqual({ included: false });
    expect(result.manifest).toHaveProperty("signature");
  });

  it("含 assets 的 workflow 可构建并打包资源", () => {
    const result = buildPwbFromDirectory(bundleAssetsDir);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(result.manifest.resources.length).toBeGreaterThan(0);

    const pngEntry = result.manifest.resources.find(r => r.path === "assets/logo.png");
    expect(pngEntry).toBeDefined();
    expect(pngEntry!.strategy).toBe("archive");
    expect(pngEntry!.size).toBeGreaterThan(0);
    expect(pngEntry!.sha256).toBeTruthy();

    const mdEntry = result.manifest.resources.find(r => r.path === "prompts/system.md");
    expect(mdEntry).toBeDefined();
    expect(mdEntry!.strategy).toBe("inline");
  });

  it("archive 资源写入 ZIP，inline 资源内联到 document.json", () => {
    const result = buildPwbFromDirectory(bundleAssetsDir);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    const entries = listZipEntries(result.pwbData);
    expect(entries).toContain("resources/assets/logo.png");
    expect(entries).not.toContain("resources/prompts/system.md");

    const zipFiles = readZip(result.pwbData);
    expect(zipFiles.has("resources/assets/logo.png")).toBe(true);
    expect(zipFiles.has("resources/prompts/system.md")).toBe(false);

    const doc = JSON.parse(zipFiles.get("document.json")!.toString("utf-8"));
    expect(doc._inlineResources).toBeDefined();
    expect(doc._inlineResources["prompts/system.md"]).toBeTruthy();
  });

  it("document.json 包含正确的 DSL 文档内容", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    const zipFiles = readZip(result.pwbData);
    const doc = JSON.parse(zipFiles.get("document.json")!.toString("utf-8"));
    expect(doc.id).toBe("bundle-flow");
    expect(doc.title).toBe("Bundle Test Workflow");
    expect(doc.nodes).toHaveLength(2);
  });
});

describe("buildPwbFromDirectory - failure paths", () => {
  it("不存在的目录返回错误诊断 BUNDLE-001", () => {
    const result = buildPwbFromDirectory("C:/nonexistent/path");
    expect(result.diagnostics.some(d => d.severity === "error")).toBe(true);
  });

  it("manifest 中已包含 configSnapshot.included = false 字段", () => {
    const result = buildPwbFromDirectory(bundleFlowDir);
    if (result.diagnostics.filter(d => d.severity === "error").length === 0) {
      expect(result.manifest.configSnapshot.included).toBe(false);
    }
  });
});
