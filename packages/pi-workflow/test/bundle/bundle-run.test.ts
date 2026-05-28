import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildPwbFromDirectory, buildPwbFromDocument } from "../../src/bundle/build.js";
import { loadPwbFile } from "../../src/bundle/load.js";
import { dslToIr } from "../../src/dsl/mapper.js";
import { WorkflowRuntime, ExecutorRegistry } from "../../src/runtime/index.js";
import { ManualExecutor, ReturnExecutor } from "../../src/executors/index.js";
import { loadFromDirectory } from "../../src/dsl/directory-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleFlowDir = resolve(__dirname, "../fixtures/bundle-flow");

let pwbPath: string;
let tmpDir: string;

function createRuntime() {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor(input => input));
  registry.register("return", new ReturnExecutor());
  return new WorkflowRuntime({ executorRegistry: registry });
}

beforeAll(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "pwb-run-test-"));
  const result = buildPwbFromDirectory(bundleFlowDir);
  pwbPath = resolve(tmpDir, "test-bundle.pwb");
  writeFileSync(pwbPath, result.pwbData);
});

describe("bundle run pipeline", () => {
  it("从 .pwb 加载的 document 可转换为 IR 并执行", async () => {
    const loadResult = loadPwbFile(pwbPath);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(loadResult.document);
    expect(ir.id).toBe("bundle-flow");
    expect(ir.nodes).toHaveLength(2);

    const runtime = createRuntime();
    const events: string[] = [];
    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }
    expect(events).toContain("workflow.completed");
    expect(events.filter(e => e === "node.completed").length).toBe(2);
  });

  it(".pwb 可独立运行（不依赖原始目录）", async () => {
    const loadResult = loadPwbFile(pwbPath);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

    const ir = dslToIr(loadResult.document);
    const runtime = createRuntime();
    const events: string[] = [];
    for await (const event of runtime.run({ ir })) {
      events.push(event.type);
    }
    expect(events).toContain("workflow.completed");
  });

  it("bundle 中的文档与原目录加载的文档内容一致", () => {
    const bundleResult = loadPwbFile(pwbPath);
    const dirResult = loadFromDirectory(bundleFlowDir);

    expect(bundleResult.document.id).toBe(dirResult.document.id);
    expect(bundleResult.document.version).toBe(dirResult.document.version);
    expect(bundleResult.document.title).toBe(dirResult.document.title);
    expect(bundleResult.document.nodes).toHaveLength(dirResult.document.nodes.length);
  });
});

describe("bundle run --dir compatibility", () => {
  it("目录可通过构建临时 bundle 再运行", () => {
    const buildResult = buildPwbFromDirectory(bundleFlowDir);
    const tmpPwb = resolve(tmpDir, "tmp-from-dir.pwb");
    writeFileSync(tmpPwb, buildResult.pwbData);

    const loadResult = loadPwbFile(tmpPwb);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(loadResult.manifest.workflow.id).toBe("bundle-flow");
  });
});

describe("bundle run --json compatibility", () => {
  it("JSON 文档可通过构建临时 bundle 再运行", () => {
    const jsonContent = readFileSync(resolve(bundleFlowDir, "flow.json"), "utf-8");
    const jsonData = JSON.parse(jsonContent) as Record<string, unknown>;

    const buildResult = buildPwbFromDocument(jsonData);
    const tmpPwb = resolve(tmpDir, "tmp-from-json.pwb");
    writeFileSync(tmpPwb, buildResult.pwbData);

    const loadResult = loadPwbFile(tmpPwb);
    expect(loadResult.diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
    expect(loadResult.manifest.workflow.id).toBe("bundle-flow");
  });
});
