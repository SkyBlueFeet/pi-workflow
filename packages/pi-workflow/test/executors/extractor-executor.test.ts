import { describe, it, expect } from "vitest";
import { ExtractorExecutor } from "../../src/executors/extractor-executor.js";
import type { WorkflowNodeIR } from "../../src/ir/types.js";
import type { ExecutionContext } from "../../src/executors/types.js";
import { NullWorkflowHost } from "../../src/host/null-host.js";

function makeNode(config?: Record<string, unknown>): WorkflowNodeIR {
  return {
    id: "ext-node",
    title: "Extractor Node",
    kind: "extractor",
    dependsOn: [],
    inputBindings: {},
    executor: config ? { type: "extractor", config } : { type: "extractor" },
    output: { to: "result", mergeStrategy: "replace" },
  };
}

function makeContext(input: Record<string, unknown>): ExecutionContext {
  return {
    runId: "test-run",
    nodeId: "ext-node",
    nodeInput: input,
    sharedContext: {},
    host: NullWorkflowHost,
  };
}

describe("ExtractorExecutor", () => {
  it("text + extract(fields): 字段提取成功", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "text", mode: "extract", fields: ["name", "age"] });
    const input = 'name: Alice, age: 30';
    const result = await executor.execute(node, makeContext({ input }));

    expect(result.output).not.toHaveProperty("error");
    const data = (result.output as any).data;
    expect(data.name).toBe("Alice");
    expect(data.age).toBe("30");
    expect((result.output as any).meta.sourceType).toBe("text");
    expect((result.output as any).meta.mode).toBe("extract");
  });

  it("html + summarize: 清洗后摘要成功", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "html", mode: "summarize", summaryStyle: "brief" });
    const html = `<html>
      <head><title>测试页面</title></head>
      <body>
        <h1>欢迎</h1>
        <p>这是第一段内容，描述了项目的背景和意义。</p>
        <p>这是第二段内容，讨论了实施的具体步骤和方法。</p>
        <p>这是第三段内容，总结了项目的成果和未来展望。</p>
        <script>alert('x')</script>
        <style>.hidden{}</style>
      </body>
    </html>`;
    const result = await executor.execute(node, makeContext({ content: html }));

    expect(result.output).not.toHaveProperty("error");
    const data = (result.output as any).data;
    expect(data.keyPoints).toBeInstanceOf(Array);
    expect(data.keyPoints.length).toBeGreaterThanOrEqual(2);
    expect((result.output as any).meta.sourceType).toBe("html");
  });

  it("code + typed-object: 输出包含模块职责与关键符号", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({
      sourceType: "code",
      mode: "typed-object",
      schema: { languageHint: "string", lineCount: "number" },
    });
    const code = `function hello() { return "world"; }\nclass MyClass {}`;
    const result = await executor.execute(node, makeContext({ input: code }));

    expect(result.output).not.toHaveProperty("error");
    const data = (result.output as any).data;
    expect(data.lineCount).toBe(2);
    expect(data.languageHint).toBeDefined();
    expect((result.output as any).meta.mode).toBe("typed-object");
  });

  it("json + extract(fields): 路径字段提取成功", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "json", mode: "extract", fields: ["user.name", "user.age"] });
    const json = { user: { name: "Alice", age: 30 }, extra: true };
    const result = await executor.execute(node, makeContext({ input: json }));

    expect(result.output).not.toHaveProperty("error");
    const data = (result.output as any).data;
    expect(data["user.name"]).toBe("Alice");
    expect(data["user.age"]).toBe(30);
  });

  it("json(string) parse failed: 返回 parse_failed", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "json", mode: "extract" });
    const result = await executor.execute(node, makeContext({ input: "{invalid json}" }));

    const output = result.output as any;
    expect(output.error).toBeDefined();
    expect(output.error.errorCode).toBe("parse_failed");
  });

  it("typed-object 缺少 schema: 默认回退并返回 warning", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "json", mode: "typed-object" });
    const result = await executor.execute(node, makeContext({ input: { a: 1 } }));

    const output = result.output as any;
    expect(output.data).toBeDefined();
    expect(output.meta.warnings).toContain("未提供 schema，已回退为无 schema 模式");
  });

  it("typed-object 缺少 schema 且 schemaRequired=true: 返回 invalid_input", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "json", mode: "typed-object", schemaRequired: true });
    const result = await executor.execute(node, makeContext({ input: { a: 1 } }));

    const output = result.output as any;
    expect(output.error).toBeDefined();
    expect(output.error.errorCode).toBe("invalid_input");
  });

  it("超长输入: 触发截断并包含 warning", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "text", mode: "extract", maxInputChars: 10 });
    const longText = "这是一段超长的文本内容，远超限制长度";
    const result = await executor.execute(node, makeContext({ input: longText }));

    const output = result.output as any;
    expect(output.meta.warnings).toBeDefined();
    expect(output.meta.warnings[0]).toContain("截断");
  });

  it("空输入返回 invalid_input", async () => {
    const executor = new ExtractorExecutor();
    const node = makeNode({ sourceType: "text", mode: "extract" });
    const result = await executor.execute(node, makeContext({}));

    const output = result.output as any;
    expect(output.error).toBeDefined();
    expect(output.error.errorCode).toBe("invalid_input");
  });
});
