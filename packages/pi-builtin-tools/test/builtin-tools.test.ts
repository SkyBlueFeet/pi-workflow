import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { readFileTool } from "../src/tools/read.js";
import { writeFileTool } from "../src/tools/write.js";
import { editFileTool } from "../src/tools/edit.js";
import { lsTool } from "../src/tools/ls.js";
import { grepTool } from "../src/tools/grep.js";
import { findTool } from "../src/tools/find.js";

const testDir = resolve(process.cwd(), "test-tmp-builtin-tools");

function setupTestDir() {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, "sample.txt"), "hello world\nline two\nline three\n", "utf-8");
  writeFileSync(join(testDir, "code.ts"), "export function foo() { return 1; }\nexport function bar() { return 2; }\n", "utf-8");
  writeFileSync(join(testDir, "large.txt"), "A".repeat(10000), "utf-8");
  mkdirSync(join(testDir, "subdir"), { recursive: true });
  writeFileSync(join(testDir, "subdir", "nested.txt"), "nested content\n", "utf-8");
}

beforeEach(setupTestDir);
afterEach(() => rmSync(testDir, { recursive: true, force: true }));

// ─── read ────────────────────────────────────────────────────────────

describe("readFileTool", () => {
  it("正常读取文件", async () => {
    const result = await readFileTool({ path: join(testDir, "sample.txt") });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("hello world");
    expect(result.content).toContain("line two");
    expect(result.content).toContain("line three");
  });

  it("offset/limit 生效", async () => {
    const result = await readFileTool({ path: join(testDir, "sample.txt"), offset: 6, limit: 5 });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("world");
    // offset=6 从 "hello world\nline two\nline three\n" (32字符) 取到末尾，共 26 字符
    expect(result.details?.truncation?.readBytes).toBe(26);
    expect(result.details?.truncation?.truncated).toBe(false);
  });

  it("截断提示包含下一次 offset", async () => {
    const result = await readFileTool({ path: join(testDir, "large.txt"), offset: 0, limit: 100 });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("继续读取");
    expect(result.details?.truncation?.truncated).toBe(true);
    expect(result.details?.truncation?.nextOffset).toBeGreaterThan(0);
  });

  it("文件不存在报错", async () => {
    const result = await readFileTool({ path: join(testDir, "nonexistent.txt") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("文件不存在");
  });

  it("路径不是文件报错", async () => {
    const result = await readFileTool({ path: testDir });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("不是文件");
  });
});

// ─── write ───────────────────────────────────────────────────────────

describe("writeFileTool", () => {
  it("覆盖写入文件", async () => {
    const target = join(testDir, "out.txt");
    const result = await writeFileTool({ path: target, content: "new content" });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("已写入");
    expect(readFileSync(target, "utf-8")).toBe("new content");
  });

  it("自动创建父目录", async () => {
    const target = join(testDir, "deep", "nested", "file.txt");
    const result = await writeFileTool({ path: target, content: "deep" });
    expect(result.isError).toBe(false);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe("deep");
  });

  it("连续写入覆盖", async () => {
    const target = join(testDir, "twice.txt");
    await writeFileTool({ path: target, content: "first" });
    await writeFileTool({ path: target, content: "second" });
    expect(readFileSync(target, "utf-8")).toBe("second");
  });
});

// ─── edit ────────────────────────────────────────────────────────────

describe("editFileTool", () => {
  it("单段替换成功", async () => {
    const target = join(testDir, "edit-test.txt");
    writeFileSync(target, "const x = 1;\nconst y = 2;\n", "utf-8");
    const result = await editFileTool({
      path: target,
      edits: [{ oldText: "const x = 1;", newText: "const x = 10;" }],
    });
    expect(result.isError).toBe(false);
    expect(readFileSync(target, "utf-8")).toContain("const x = 10;");
    expect(result.details?.editCount).toBe(1);
  });

  it("多段替换成功", async () => {
    const target = join(testDir, "multi-edit.txt");
    writeFileSync(target, "line1\nline2\nline3\n", "utf-8");
    const result = await editFileTool({
      path: target,
      edits: [
        { oldText: "line1", newText: "LINE1" },
        { oldText: "line3", newText: "LINE3" },
      ],
    });
    expect(result.isError).toBe(false);
    const content = readFileSync(target, "utf-8");
    expect(content).toContain("LINE1");
    expect(content).toContain("LINE3");
    expect(result.details?.editCount).toBe(2);
  });

  it("oldText 不匹配时报错", async () => {
    const target = join(testDir, "no-match.txt");
    writeFileSync(target, "hello", "utf-8");
    const result = await editFileTool({
      path: target,
      edits: [{ oldText: "nonexistent", newText: "x" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("未在文件中找到匹配");
  });

  it("patch 包含在 details 中", async () => {
    const target = join(testDir, "patch-test.txt");
    writeFileSync(target, "old line\n", "utf-8");
    const result = await editFileTool({
      path: target,
      edits: [{ oldText: "old line", newText: "new line" }],
    });
    expect(result.isError).toBe(false);
    expect(result.details?.patch).toBeDefined();
    expect(result.details!.patch!.length).toBeGreaterThan(0);
  });

  it("无编辑项报错", async () => {
    const result = await editFileTool({ path: join(testDir, "sample.txt"), edits: [] });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("未提供编辑项");
  });

  it("文件不存在报错", async () => {
    const result = await editFileTool({
      path: join(testDir, "nonexistent.txt"),
      edits: [{ oldText: "x", newText: "y" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("文件不存在");
  });
});

// ─── ls ──────────────────────────────────────────────────────────────

describe("lsTool", () => {
  it("列出目录项", async () => {
    const result = await lsTool({ path: testDir });
    expect(result.isError).toBe(false);
    expect(result.details?.entries.length).toBeGreaterThanOrEqual(3);
    const names = result.details!.entries.map(e => e.name);
    expect(names).toContain("sample.txt");
    expect(names).toContain("subdir");
  });

  it("区分文件与目录", async () => {
    const result = await lsTool({ path: testDir });
    const subdir = result.details!.entries.find(e => e.name === "subdir");
    expect(subdir?.type).toBe("directory");
    const file = result.details!.entries.find(e => e.name === "sample.txt");
    expect(file?.type).toBe("file");
  });

  it("目录不存在报错", async () => {
    const result = await lsTool({ path: join(testDir, "nonexistent") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("目录不存在");
  });

  it("路径不是目录报错", async () => {
    const result = await lsTool({ path: join(testDir, "sample.txt") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("不是目录");
  });
});

// ─── grep ────────────────────────────────────────────────────────────

describe("grepTool", () => {
  it("单文件匹配", async () => {
    const result = await grepTool({ pattern: "hello", path: join(testDir, "sample.txt") });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("hello world");
    expect(result.details?.total).toBe(1);
  });

  it("目录递归匹配", async () => {
    const result = await grepTool({ pattern: "content", path: testDir, recursive: true });
    expect(result.isError).toBe(false);
    expect(result.details!.total).toBe(1);
    expect(result.content).toContain("nested content");
  });

  it("截断后仍给出统计", async () => {
    // Create files with many matching lines
    mkdirSync(join(testDir, "many"), { recursive: true });
    for (let i = 0; i < 60; i++) {
      writeFileSync(join(testDir, "many", `f${i}.txt`), `match line ${i}\n`, "utf-8");
    }
    const result = await grepTool({ pattern: "match", path: join(testDir, "many"), recursive: true, maxResults: 10 });
    expect(result.isError).toBe(false);
    expect(result.details!.truncated).toBe(true);
    expect(result.details!.total).toBeLessThanOrEqual(10);
    expect(result.content.split("\n").length).toBeLessThanOrEqual(10);
  });

  it("无效正则报错", async () => {
    const result = await grepTool({ pattern: "[invalid", path: testDir });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("无效的正则表达式");
  });

  it("路径不存在报错", async () => {
    const result = await grepTool({ pattern: "x", path: join(testDir, "nope") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("路径不存在");
  });

  it("无匹配时返回提示", async () => {
    const result = await grepTool({ pattern: "zzzzz_nonexistent_zzzzz", path: join(testDir, "sample.txt") });
    expect(result.isError).toBe(false);
    expect(result.content).toBe("无匹配结果");
  });
});

// ─── find ────────────────────────────────────────────────────────────

describe("findTool", () => {
  it("名称模式匹配", async () => {
    const result = await findTool({ pattern: "*.txt", path: testDir });
    expect(result.isError).toBe(false);
    expect(result.details!.total).toBeGreaterThanOrEqual(1);
    const paths = result.details!.entries.map(e => e.path);
    expect(paths.some(p => p.includes("sample.txt"))).toBe(true);
  });

  it("深度限制生效", async () => {
    // Create nested structure
    mkdirSync(join(testDir, "deep1", "deep2", "deep3"), { recursive: true });
    writeFileSync(join(testDir, "deep1", "deep2", "deep3", "buried.txt"), "deep", "utf-8");
    const result = await findTool({ pattern: "*.txt", path: testDir, maxDepth: 1 });
    expect(result.isError).toBe(false);
    const paths = result.details!.entries.map(e => e.path);
    expect(paths.some(p => p.includes("buried.txt"))).toBe(false);
  });

  it("路径不存在报错", async () => {
    const result = await findTool({ pattern: "*.txt", path: join(testDir, "bad") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("路径不存在");
  });

  it("无匹配时返回提示", async () => {
    const result = await findTool({ pattern: "*.xyz", path: testDir });
    expect(result.isError).toBe(false);
    expect(result.content).toBe("无匹配文件");
  });
});
