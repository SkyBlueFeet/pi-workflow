import { describe, it, expect } from "vitest";
import { computeContextDiff } from "../../src/index.js";

describe("computeContextDiff", () => {
  it("空对象无差异", () => {
    const diff = computeContextDiff({}, {});
    expect(diff).toHaveLength(0);
  });

  it("相同对象无差异", () => {
    const diff = computeContextDiff({ a: 1, b: "hello" }, { a: 1, b: "hello" });
    expect(diff).toHaveLength(0);
  });

  it("检测新增字段", () => {
    const diff = computeContextDiff({}, { a: 42 });
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe("a");
    expect(diff[0].type).toBe("added");
  });

  it("检测删除字段", () => {
    const diff = computeContextDiff({ a: 42 }, {});
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe("a");
    expect(diff[0].type).toBe("removed");
  });

  it("检测字段值变化", () => {
    const diff = computeContextDiff({ a: 1 }, { a: 2 });
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe("a");
    expect(diff[0].type).toBe("changed");
    expect(diff[0].oldValue).toBe(1);
    expect(diff[0].newValue).toBe(2);
  });

  it("跳过 _ 开头的字段", () => {
    const diff = computeContextDiff({ _internal: "secret" }, { _internal: "changed" });
    expect(diff).toHaveLength(0);
  });

  it("递归检测嵌套对象变化", () => {
    const diff = computeContextDiff(
      { config: { host: "localhost", port: 8080 } },
      { config: { host: "127.0.0.1", port: 8080 } },
    );
    expect(diff.some(e => e.path === "config.host" && e.type === "changed")).toBe(true);
  });

  it("截断大值", () => {
    const longString = "x".repeat(500);
    const diff = computeContextDiff({}, { data: longString });
    expect(diff[0].newValue).toContain("...");
  });
});
