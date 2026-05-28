import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { resolveWorkflowTools } from "../../src/agents/workflow-tool-bridge.js";
import type { ResolvedAgentConfig, WorkflowToolDefinition } from "../../src/agents/types.js";
import type { WorkflowConfig } from "../../src/config/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "bridge-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const simpleWorkflow = {
  id: "wf1", version: "1", title: "WF1",
  entry: "start", nodes: [
    { id: "start", executor: { type: "manual" }, inputs: { v: { from: "literal", value: "x" } } },
  ],
};

describe("resolveWorkflowTools", () => {
  it("内联 IR 返回已解析工具", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        inlineTool: {
          name: "inlineTool",
          description: "An inline tool",
          workflow: simpleWorkflow,
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("inlineTool");
    expect(result.tools[0].description).toBe("An inline tool");
    expect(result.tools[0].workflow.id).toBe("wf1");
    expect(result.errors).toHaveLength(0);
  });

  it("文件路径加载 JSON 格式工作流", () => {
    writeFileSync(resolve(tmpDir, "sub.json"), JSON.stringify(simpleWorkflow), "utf-8");

    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        fileTool: {
          name: "fileTool",
          workflowPath: "./sub.json",
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config, tmpDir);
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("fileTool");
    expect(result.tools[0].workflow.id).toBe("wf1");
  });

  it("路径不存在时返回错误而非抛出", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        badTool: {
          name: "badTool",
          workflowPath: "./nonexistent/workflow.json",
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = { baseDir: tmpDir };

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe("badTool");
    expect(result.errors[0].message).toContain("路径不存在");
  });

  it("缺少 workflowPath 和 workflow 定义时返回错误", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        incomplete: {
          name: "incomplete",
        } as WorkflowToolDefinition,
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("缺少 workflowPath");
  });

  it("多个工具部分失败时返回成功与错误列表", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        good: {
          name: "good",
          workflow: simpleWorkflow,
        },
        bad: {
          name: "bad",
          workflowPath: "./missing.json",
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = { baseDir: tmpDir };

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("good");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe("bad");
  });

  it("透传 inputSchema 和 permissions", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        tool1: {
          name: "tool1",
          workflow: simpleWorkflow,
          inputSchema: { type: "object", properties: { x: { type: "string" } } },
          permissions: [{ capability: "fs.read" }],
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools[0].inputSchema).toEqual({ type: "object", properties: { x: { type: "string" } } });
    expect(result.tools[0].permissions).toHaveLength(1);
    expect(result.tools[0].permissions![0].capability).toBe("fs.read");
  });

  it("空 workflowTools 返回空结果", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {},
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("cwd 参数影响路径解析", () => {
    const nestedDir = resolve(tmpDir, "nested");
    const wfPath = resolve(nestedDir, "wf.json");
    const finalDir = resolve(tmpDir, "final");
    const baseDir = resolve(tmpDir, "base");

    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        tool1: {
          name: "tool1",
          workflowPath: "./wf.json",
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = { baseDir };

    const result = resolveWorkflowTools(resolvedConfig, config, tmpDir);
    expect(result.errors[0].message).toContain("路径不存在");
  });

  it("目录格式路径调用 loadFromDirectory", () => {
    const dirPath = resolve(tmpDir, "mywf");
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(resolve(dirPath, "workflow.json"), JSON.stringify(simpleWorkflow), "utf-8");

    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        dirTool: {
          name: "dirTool",
          workflowPath: dirPath,
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config, tmpDir);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("dirTool");
    expect(result.errors).toHaveLength(0);
  });

  it("description 为 undefined 时仍正常工作", () => {
    const resolvedConfig: ResolvedAgentConfig = {
      systemPrompt: "test",
      skills: [],
      tools: [],
      workflowTools: {
        noDesc: {
          name: "noDesc",
          workflow: simpleWorkflow,
        },
      },
      mcp: [],
      permissions: [],
    };
    const config: WorkflowConfig = {};

    const result = resolveWorkflowTools(resolvedConfig, config);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].description).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });
});
