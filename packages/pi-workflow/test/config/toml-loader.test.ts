import { describe, expect, it } from "vitest";
import { tomlToWorkflowConfig } from "../../src/config/toml-loader.js";

describe("tomlToWorkflowConfig", () => {
  it("解析 agents 和 workflowTools 配置", () => {
    const config = tomlToWorkflowConfig({
      agents: {
        writer: {
          name: "Writer",
          systemPrompt: "You are a writer.",
          skills: ["outline"],
          tools: [{ name: "search", source: "workflow", description: "Search docs" }],
          mcp: ["ctx7"],
          workflowTools: {
            summarize: {
              description: "Summarize content",
              workflowPath: "./flows/summarize",
              permissions: [{ capability: "workflow.invoke" }],
            },
          },
          permissions: [{ capability: "extension.execute" }],
        },
      },
      workflowTools: {
        translate: {
          description: "Translate content",
          workflowPath: "./flows/translate",
          permissions: [{ capability: "workflow.invoke" }],
        },
      },
    }, "E:/repo/configs/workflow.toml");

    expect(config.baseDir).toBe("E:/repo/configs");
    expect(config.agents?.writer.skills?.[0].name).toBe("outline");
    expect(config.agents?.writer.tools?.[0].name).toBe("search");
    expect(config.agents?.writer.mcp?.[0].server).toBe("ctx7");
    expect(config.agents?.writer.permissions?.[0].capability).toBe("extension.execute");
    expect(config.agents?.writer.workflowTools?.summarize.workflowPath).toBe("./flows/summarize");
    expect(config.agents?.writer.workflowTools?.summarize.permissions?.[0].capability).toBe("workflow.invoke");
    expect(config.workflowTools?.translate.workflowPath).toBe("./flows/translate");
    expect(config.workflowTools?.translate.permissions?.[0].capability).toBe("workflow.invoke");
  });

  it("解析 security 配置", () => {
    const config = tomlToWorkflowConfig({
      security: {
        defaultMode: "deny",
        permissions: [
          { capability: "fs.read", scope: { path: "/tmp" } },
          { capability: "network.request" },
        ],
        nodes: {
          "http-1": {
            permissions: [{ capability: "network.request" }],
          },
        },
        audit: {
          enabled: true,
          includeDenyDecisions: true,
          includeAllowDecisions: false,
        },
      },
    });

    expect(config.security).toBeDefined();
    expect(config.security!.defaultMode).toBe("deny");
    expect(config.security!.permissions).toHaveLength(2);
    expect(config.security!.permissions![0].capability).toBe("fs.read");
    expect(config.security!.permissions![0].scope).toEqual({ path: "/tmp" });
    expect(config.security!.permissions![1].capability).toBe("network.request");
    expect(config.security!.nodes!["http-1"].permissions).toHaveLength(1);
    expect(config.security!.audit!.enabled).toBe(true);
    expect(config.security!.audit!.includeDenyDecisions).toBe(true);
  });

  it("security 配置为空时返回 undefined", () => {
    const config = tomlToWorkflowConfig({});
    expect(config.security).toBeUndefined();
  });

  it("security.defaultMode 非法时报错", () => {
    expect(() => tomlToWorkflowConfig({
      security: { defaultMode: "invalid" },
    })).toThrow();
  });

  it("security.permissions 非数组时报错", () => {
    expect(() => tomlToWorkflowConfig({
      security: { permissions: "invalid" },
    })).toThrow();
  });
});
