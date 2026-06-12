/**
 * Catalog 服务测试。
 */

import { describe, it, expect } from "vitest";
import { WorkflowCatalogServiceImpl } from "../src/services/workflow-catalog-service.js";
import { AgentCatalogServiceImpl } from "../src/services/agent-catalog-service.js";
import { SkillCatalogServiceImpl } from "../src/services/skill-catalog-service.js";
import { ToolCatalogServiceImpl } from "../src/services/tool-catalog-service.js";
import { ResourceCatalogServiceImpl } from "../src/services/resource-catalog-service.js";
import { RunCatalogServiceImpl } from "../src/services/run-catalog-service.js";
import { WorkflowAuthoringServiceImpl } from "../src/services/workflow-authoring-service.js";
import { AgentAuthoringServiceImpl } from "../src/services/agent-authoring-service.js";

describe("WorkflowCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new WorkflowCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });

  it("骨架实现 get 返回 undefined", async () => {
    const service = new WorkflowCatalogServiceImpl();
    const entry = await service.get("non-existent");
    expect(entry).toBeUndefined();
  });

  it("has 对不存在的 ID 返回 false", async () => {
    const service = new WorkflowCatalogServiceImpl();
    expect(await service.has("non-existent")).toBe(false);
  });
});

describe("AgentCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new AgentCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });

  it("骨架实现 get 返回 undefined", async () => {
    const service = new AgentCatalogServiceImpl();
    const entry = await service.get("non-existent");
    expect(entry).toBeUndefined();
  });
});

describe("SkillCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new SkillCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });
});

describe("ToolCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new ToolCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });
});

describe("ResourceCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new ResourceCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });
});

describe("RunCatalogService", () => {
  it("骨架实现返回空列表", async () => {
    const service = new RunCatalogServiceImpl();
    const list = await service.list();
    expect(list).toEqual([]);
  });

  it("getResumable 返回空列表", async () => {
    const service = new RunCatalogServiceImpl();
    const resumable = await service.getResumable();
    expect(resumable).toEqual([]);
  });
});

describe("WorkflowAuthoringService", () => {
  it("generateDraft 返回草稿对象", async () => {
    const service = new WorkflowAuthoringServiceImpl();
    const draft = await service.generateDraft("测试 workflow");
    expect(draft.draftId).toMatch(/^wf-draft-/);
    expect(draft.description).toBe("测试 workflow");
    expect(draft.status).toBe("draft");
    expect(draft.nodes.length).toBe(2);
  });

  it("validateDraft 至少两个节点通过", async () => {
    const service = new WorkflowAuthoringServiceImpl();
    const draft = await service.generateDraft("测试");
    const result = await service.validateDraft(draft.draftId);
    expect(result.valid).toBe(true);
  });

  it("validateDraft 不存在的草稿返回错误", async () => {
    const service = new WorkflowAuthoringServiceImpl();
    const result = await service.validateDraft("non-existent");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("previewDraft 返回草稿内容", async () => {
    const service = new WorkflowAuthoringServiceImpl();
    const draft = await service.generateDraft("预览测试");
    const preview = await service.previewDraft(draft.draftId);
    expect(preview.draftId).toBe(draft.draftId);
    expect(preview.description).toBe("预览测试");
  });
});

describe("AgentAuthoringService", () => {
  it("generateDraft 返回草稿对象", async () => {
    const service = new AgentAuthoringServiceImpl();
    const draft = await service.generateDraft("测试 agent");
    expect(draft.draftId).toMatch(/^agent-draft-/);
    expect(draft.description).toBe("测试 agent");
    expect(draft.status).toBe("draft");
    expect(draft.systemPrompt).toContain("测试 agent");
  });

  it("validateDraft 有 systemPrompt 通过", async () => {
    const service = new AgentAuthoringServiceImpl();
    const draft = await service.generateDraft("测试");
    const result = await service.validateDraft(draft.draftId);
    expect(result.valid).toBe(true);
  });

  it("validateDraft 不存在的草稿返回错误", async () => {
    const service = new AgentAuthoringServiceImpl();
    const result = await service.validateDraft("non-existent");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
