import { describe, it, expect } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WorkflowLinter,
  WorkflowTemplateRegistry,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "../fixtures/authoring/templates");

describe("WorkflowTemplateRegistry", () => {
  it("可列出模板元信息", () => {
    const registry = new WorkflowTemplateRegistry(templatesDir);
    const templates = registry.listTemplates();

    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe("simple-review");
    expect(templates[0].tags).toEqual(["review", "manual"]);
  });

  it("可加载模板并返回目录 workflow 文档", () => {
    const registry = new WorkflowTemplateRegistry(templatesDir);
    const result = registry.loadTemplate("simple-review");

    expect(result.template.title).toBe("Simple Review");
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toHaveLength(0);
    expect(result.document.id).toBe("simple-review");
    expect(result.document.nodes).toHaveLength(2);
  });

  it("加载后的模板可直接复用 linter", () => {
    const registry = new WorkflowTemplateRegistry(templatesDir);
    const linter = new WorkflowLinter();
    const template = registry.loadTemplate("simple-review");
    const lintResult = linter.lintObject(template.document as unknown as Record<string, unknown>);

    expect(lintResult.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toHaveLength(0);
  });
});
