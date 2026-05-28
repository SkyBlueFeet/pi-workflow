import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildPwbFromDirectory } from "../../src/bundle/build.js";
import { loadPwbFile } from "../../src/bundle/load.js";
import { createZip } from "../../src/bundle/zip-util.js";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleFlowDir = resolve(__dirname, "../fixtures/bundle-flow");

let pwbPath: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "pwb-test-"));
  const result = buildPwbFromDirectory(bundleFlowDir);
  pwbPath = resolve(tmpDir, "test-bundle.pwb");
  writeFileSync(pwbPath, result.pwbData);
});

describe("loadPwbFile", () => {
  it("正常加载 .pwb 文件并返回 manifest、document 和 resourceReader", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(result.manifest.kind).toBe("pi-workflow-bundle");
    expect(result.document.id).toBe("bundle-flow");
    expect(result.resourceReader).toBeDefined();
  });

  it("返回的 document 可被 DSL 校验并通过", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.document.nodes).toHaveLength(2);
    expect(result.document.entry).toBe("start");
  });

  it("返回的 manifest 包含完整的元数据", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.manifest.source.type).toBe("directory");
    expect(result.manifest.document.path).toBe("document.json");
    expect(result.manifest.document.sha256).toBeTruthy();
    expect(result.manifest.document.size).toBeGreaterThan(0);
  });

  it("resourceReader 对于没有资源的 bundle 返回 false", () => {
    const result = loadPwbFile(pwbPath);
    expect(result.resourceReader.has("nonexistent")).toBe(false);
  });
});

describe("loadPwbFile - failure paths", () => {
  it("不存在的文件返回 BUNDLE-001 错误", () => {
    const result = loadPwbFile("/nonexistent/file.pwb");
    expect(result.diagnostics.some(d => d.code === "BUNDLE-001")).toBe(true);
  });

  it("缺失 manifest.json 返回 BUNDLE-002 错误", () => {
    const badZip = createZip(new Map([
      ["document.json", Buffer.from('{"id":"test"}')],
    ]));
    const badPath = resolve(tmpDir, "no-manifest.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-002")).toBe(true);
  });

  it("缺失 document.json 返回 BUNDLE-003 错误", () => {
    const manifest = {
      kind: "pi-workflow-bundle",
      bundleVersion: "1",
      workflow: { id: "test" },
      source: { type: "directory", entry: "flow.json", builtAt: new Date().toISOString() },
      document: { path: "document.json", sha256: "abc", size: 0 },
      resources: [],
      configSnapshot: { included: false },
    };
    const badZip = createZip(new Map([
      ["manifest.json", Buffer.from(JSON.stringify(manifest))],
    ]));
    const badPath = resolve(tmpDir, "no-document.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-003")).toBe(true);
  });

  it("document 哈希不匹配返回 BUNDLE-006 错误", () => {
    const manifest = {
      kind: "pi-workflow-bundle",
      bundleVersion: "1",
      workflow: { id: "test" },
      source: { type: "directory", entry: "flow.json", builtAt: new Date().toISOString() },
      document: { path: "document.json", sha256: "0000000000000000000000000000000000000000000000000000000000000000", size: 5 },
      resources: [],
      configSnapshot: { included: false },
    };
    const badZip = createZip(new Map([
      ["manifest.json", Buffer.from(JSON.stringify(manifest))],
      ["document.json", Buffer.from('{"id":"test"}')],
    ]));
    const badPath = resolve(tmpDir, "bad-hash.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-006")).toBe(true);
  });

  it("资源大小不匹配返回 BUNDLE-007 错误", () => {
    const resourceData = Buffer.from("resource-data");
    const resourceHash = createHash("sha256").update(resourceData).digest("hex");
    const documentData = Buffer.from(JSON.stringify({
      id: "test",
      version: "1",
      title: "Test",
      entry: "start",
      nodes: [
        {
          id: "start",
          title: "Start",
          executor: { type: "manual" },
        },
      ],
    }));
    const documentHash = createHash("sha256").update(documentData).digest("hex");
    const manifest = {
      kind: "pi-workflow-bundle",
      bundleVersion: "1",
      workflow: { id: "test" },
      source: { type: "directory", entry: "flow.json", builtAt: new Date().toISOString() },
      document: { path: "document.json", sha256: documentHash, size: documentData.length },
      resources: [{
        path: "assets/data.bin",
        sourcePath: "assets/data.bin",
        strategy: "archive",
        size: resourceData.length + 1,
        sha256: resourceHash,
        usage: ["node:test:asset"],
      }],
      configSnapshot: { included: false },
    };
    const badZip = createZip(new Map([
      ["manifest.json", Buffer.from(JSON.stringify(manifest))],
      ["document.json", documentData],
      ["resources/assets/data.bin", resourceData],
    ]));
    const badPath = resolve(tmpDir, "bad-resource-size.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-007")).toBe(true);
    expect(result.diagnostics.some(d => d.message.includes("大小不匹配"))).toBe(true);
  });

  it("非法的 bundleVersion 返回 BUNDLE-004 错误", () => {
    const badManifest = {
      kind: "pi-workflow-bundle",
      bundleVersion: "999",
      workflow: { id: "test" },
      source: { type: "directory", entry: "flow.json", builtAt: new Date().toISOString() },
      document: { path: "document.json", sha256: "abc", size: 0 },
      resources: [],
      configSnapshot: { included: false },
    };
    const badZip = createZip(new Map([
      ["manifest.json", Buffer.from(JSON.stringify(badManifest))],
      ["document.json", Buffer.from('{"id":"test","version":"1","title":"Test","entry":"root","nodes":[]}')],
    ]));
    const badPath = resolve(tmpDir, "bad-version.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-004")).toBe(true);
  });

  it("非法的 kind 返回 BUNDLE-005 错误", () => {
    const badManifest = {
      kind: "not-pi-workflow-bundle",
      bundleVersion: "1",
      workflow: { id: "test" },
      source: { type: "directory", entry: "flow.json", builtAt: new Date().toISOString() },
      document: { path: "document.json", sha256: "abc", size: 0 },
      resources: [],
      configSnapshot: { included: false },
    };
    const badZip = createZip(new Map([
      ["manifest.json", Buffer.from(JSON.stringify(badManifest))],
      ["document.json", Buffer.from('{"id":"test","version":"1","title":"Test","entry":"root","nodes":[]}')],
    ]));
    const badPath = resolve(tmpDir, "bad-kind.pwb");
    writeFileSync(badPath, badZip);
    const result = loadPwbFile(badPath);
    expect(result.diagnostics.some(d => d.code === "BUNDLE-005")).toBe(true);
  });
});
