import { describe, it, expect } from "vitest";
import { TemplateExecutor } from "../../src/executors/template-executor.js";
import { AssignExecutor } from "../../src/executors/assign-executor.js";
import { MergeExecutor } from "../../src/executors/merge-executor.js";
import { DelayExecutor } from "../../src/executors/delay-executor.js";
import { ListOpExecutor } from "../../src/executors/list-op-executor.js";
import { CodeExecutor } from "../../src/executors/code-executor.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";

function makeNode(kind: WorkflowNodeIR["kind"], config?: Record<string, unknown>, outputTo?: string): WorkflowNodeIR {
  return {
    id: `${kind}-node`,
    title: `${kind} Node`,
    kind,
    dependsOn: [],
    inputBindings: {},
    executor: { type: kind, config },
    output: outputTo ? { to: outputTo, mergeStrategy: "replace" } : undefined,
  };
}

function makeCtx(input: Record<string, unknown>, shared: Record<string, unknown> = {}): ExecutionContext {
  return { runId: "test", nodeId: "n", nodeInput: input, sharedContext: shared, host: {} as any };
}

// ─── TemplateExecutor ────────────────────────────────────────────────────────

describe("TemplateExecutor", () => {
  const exec = new TemplateExecutor();

  it("渲染简单变量", async () => {
    const node = makeNode("template", { template: "Hello, {{name}}!" });
    const result = await exec.execute(node, makeCtx({ name: "World" }));
    expect(result.output).toBe("Hello, World!");
  });

  it("支持嵌套路径 {{user.name}}", async () => {
    const node = makeNode("template", { template: "Hi {{user.name}}" });
    const result = await exec.execute(node, makeCtx({ user: { name: "Alice" } }));
    expect(result.output).toBe("Hi Alice");
  });

  it("未定义变量替换为空字符串", async () => {
    const node = makeNode("template", { template: "{{a}} and {{b}}" });
    const result = await exec.execute(node, makeCtx({ a: "foo" }));
    expect(result.output).toBe("foo and ");
  });

  it("template 为空时返回带 warning 的 output", async () => {
    const node = makeNode("template", {});
    const result = await exec.execute(node, makeCtx({}));
    expect((result.output as any).warning).toMatch(/空/);
  });

  it("artifact type 为 template", async () => {
    const node = makeNode("template", { template: "x" });
    const result = await exec.execute(node, makeCtx({}));
    expect(result.artifacts?.[0].type).toBe("template");
  });
});

// ─── AssignExecutor ───────────────────────────────────────────────────────────

describe("AssignExecutor", () => {
  const exec = new AssignExecutor();

  it("将 nodeInput[key] 写入对应路径", async () => {
    const node = makeNode("assign", {
      assignments: [{ key: "val", to: "ctx.result" }],
    });
    const result = await exec.execute(node, makeCtx({ val: 42 }));
    expect((result.output as any).assigned).toBe(1);
    expect(result.artifacts?.[0]).toMatchObject({ type: "assign", data: 42, targetPath: "ctx.result" });
  });

  it("多条赋值各自生成一个 artifact", async () => {
    const node = makeNode("assign", {
      assignments: [
        { key: "a", to: "x" },
        { key: "b", to: "y" },
      ],
    });
    const result = await exec.execute(node, makeCtx({ a: 1, b: 2 }));
    expect(result.artifacts).toHaveLength(2);
    expect((result.output as any).assigned).toBe(2);
  });

  it("assignments 为空时返回 assigned: 0", async () => {
    const node = makeNode("assign", { assignments: [] });
    const result = await exec.execute(node, makeCtx({}));
    expect((result.output as any).assigned).toBe(0);
  });
});

// ─── MergeExecutor ────────────────────────────────────────────────────────────

describe("MergeExecutor", () => {
  const exec = new MergeExecutor();

  it("first-defined 取第一个非 null 值", async () => {
    const node = makeNode("merge", { strategy: "first-defined" });
    const result = await exec.execute(node, makeCtx({ a: undefined, b: null, c: "found" }));
    expect(result.output).toBe("found");
  });

  it("merge-object 合并所有对象", async () => {
    const node = makeNode("merge", { strategy: "merge-object" });
    const result = await exec.execute(node, makeCtx({ x: { a: 1 }, y: { b: 2 } }));
    expect(result.output).toEqual({ a: 1, b: 2 });
  });

  it("concat-array 拼接数组", async () => {
    const node = makeNode("merge", { strategy: "concat-array" });
    const result = await exec.execute(node, makeCtx({ p: [1, 2], q: [3, 4] }));
    expect(result.output).toEqual([1, 2, 3, 4]);
  });

  it("所有输入均为 null/undefined 时返回 undefined", async () => {
    const node = makeNode("merge", {});
    const result = await exec.execute(node, makeCtx({ a: undefined, b: null }));
    expect(result.output).toBeUndefined();
  });
});

// ─── DelayExecutor ────────────────────────────────────────────────────────────

describe("DelayExecutor", () => {
  const exec = new DelayExecutor();

  it("等待指定毫秒后返回", async () => {
    const node = makeNode("delay", { delayMs: 10 });
    const start = Date.now();
    const result = await exec.execute(node, makeCtx({}));
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
    expect((result.output as any).delayMs).toBe(10);
  });

  it("AbortSignal 中断时 reject", async () => {
    const node = makeNode("delay", { delayMs: 5000 });
    const ac = new AbortController();
    const ctx = { ...makeCtx({}), signal: ac.signal };
    const p = exec.execute(node, ctx);
    setTimeout(() => ac.abort(), 10);
    await expect(p).rejects.toThrow(/aborted/);
  });
});

// ─── ListOpExecutor ───────────────────────────────────────────────────────────

describe("ListOpExecutor", () => {
  const exec = new ListOpExecutor();

  it("filter 过滤元素", async () => {
    const node = makeNode("list-op", { operation: "filter", expression: "item > 2" });
    const result = await exec.execute(node, makeCtx({ items: [1, 2, 3, 4] }));
    expect(result.output).toEqual([3, 4]);
  });

  it("map 转换元素", async () => {
    const node = makeNode("list-op", { operation: "map", expression: "item * 2" });
    const result = await exec.execute(node, makeCtx({ items: [1, 2, 3] }));
    expect(result.output).toEqual([2, 4, 6]);
  });

  it("sort 升序", async () => {
    const node = makeNode("list-op", { operation: "sort" });
    const result = await exec.execute(node, makeCtx({ items: [3, 1, 2] }));
    expect(result.output).toEqual([1, 2, 3]);
  });

  it("sort 按 key 降序", async () => {
    const node = makeNode("list-op", { operation: "sort", sortKey: "v", sortOrder: "desc" });
    const result = await exec.execute(node, makeCtx({ items: [{ v: 1 }, { v: 3 }, { v: 2 }] }));
    expect((result.output as any[]).map(x => x.v)).toEqual([3, 2, 1]);
  });

  it("slice 截取", async () => {
    const node = makeNode("list-op", { operation: "slice", sliceStart: 1, sliceEnd: 3 });
    const result = await exec.execute(node, makeCtx({ items: [10, 20, 30, 40] }));
    expect(result.output).toEqual([20, 30]);
  });

  it("unique 去重", async () => {
    const node = makeNode("list-op", { operation: "unique" });
    const result = await exec.execute(node, makeCtx({ items: [1, 2, 1, 3, 2] }));
    expect(result.output).toEqual([1, 2, 3]);
  });

  it("非数组输入返回 error artifact", async () => {
    const node = makeNode("list-op", { operation: "filter" });
    const result = await exec.execute(node, makeCtx({ items: "not an array" }));
    expect(result.artifacts?.[0].type).toBe("list-op.error");
  });
});

// ─── CodeExecutor ─────────────────────────────────────────────────────────────

describe("CodeExecutor", () => {
  const exec = new CodeExecutor();

  it("执行简单脚本并返回值", async () => {
    const node = makeNode("code", { script: "return input.a + input.b;" });
    const result = await exec.execute(node, makeCtx({ a: 3, b: 4 }));
    expect(result.output).toBe(7);
  });

  it("可访问 context 变量", async () => {
    const node = makeNode("code", { script: "return context.greeting + ' world';" });
    const result = await exec.execute(node, makeCtx({}, { greeting: "hello" }));
    expect(result.output).toBe("hello world");
  });

  it("脚本语法错误时返回 error artifact", async () => {
    const node = makeNode("code", { script: "return @@@;" });
    const result = await exec.execute(node, makeCtx({}));
    expect(result.artifacts?.[0].type).toBe("code.error");
    expect((result.output as any).error).toMatch(/失败/);
  });

  it("超时时返回 error artifact", async () => {
    const node = makeNode("code", { script: "while(true){}", timeout: 100 });
    const result = await exec.execute(node, makeCtx({}));
    expect(result.artifacts?.[0].type).toBe("code.error");
  });

  it("script 为空时返回 error", async () => {
    const node = makeNode("code", {});
    const result = await exec.execute(node, makeCtx({}));
    expect((result.output as any).error).toMatch(/script/);
  });

  it("无法访问 process 等全局对象（沙箱隔离）", async () => {
    const node = makeNode("code", { script: "return typeof process;" });
    const result = await exec.execute(node, makeCtx({}));
    expect(result.output).toBe("undefined");
  });
});
