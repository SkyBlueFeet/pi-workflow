import { describe, it, expect } from "vitest";
import { resolveSecurityContext, resolveNodeSecurity, resolveAgentSecurity, resolveSubWorkflowSecurity } from "../../src/security/resolver.js";
import type { WorkflowSecurityConfig, ResolvedSecurityContext } from "../../src/security/types.js";

describe("resolveSecurityContext", () => {
  it("从空的 config 返回默认 deny 上下文", () => {
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "workflow" });
    expect(ctx.runId).toBe("run-1");
    expect(ctx.actorType).toBe("workflow");
    expect(ctx.grants).toEqual([]);
  });

  it("从 config 中获取顶层权限", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "network.request" }],
    };
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "workflow", config });
    expect(ctx.grants).toHaveLength(2);
    expect(ctx.grants[0].capability).toBe("fs.read");
    expect(ctx.grants[1].capability).toBe("network.request");
  });

  it("节点级权限与顶层权限做交集", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "fs.write" }, { capability: "network.request" }],
      nodes: {
        "node-1": { permissions: [{ capability: "fs.read" }] },
      },
    };
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "workflow", config, nodeId: "node-1" });
    expect(ctx.grants).toHaveLength(1);
    expect(ctx.grants[0].capability).toBe("fs.read");
  });

  it("父级上下文与当前权限做交集", () => {
    const parent: ResolvedSecurityContext = {
      runId: "parent-run",
      actorType: "workflow",
      grants: [{ capability: "fs.read" }],
    };
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "fs.write" }],
    };
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "workflow", config, parentContext: parent });
    expect(ctx.grants).toHaveLength(1);
    expect(ctx.grants[0].capability).toBe("fs.read");
  });

  it("节点权限不能超出父级权限", () => {
    const parent: ResolvedSecurityContext = {
      runId: "parent-run",
      actorType: "workflow",
      grants: [{ capability: "fs.read" }],
    };
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.write" }],
      nodes: {
        "node-1": { permissions: [{ capability: "fs.write" }, { capability: "process.execute" }] },
      },
    };
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "workflow", config, nodeId: "node-1", parentContext: parent });
    expect(ctx.grants).toHaveLength(0);
  });

  it("无 config 时返回空 grants", () => {
    const ctx = resolveSecurityContext({ runId: "run-1", actorType: "agent" });
    expect(ctx.grants).toEqual([]);
    expect(ctx.actorType).toBe("agent");
  });
});

describe("resolveNodeSecurity", () => {
  it("无节点权限时返回原上下文", () => {
    const ctx: ResolvedSecurityContext = { runId: "run-1", actorType: "workflow", grants: [{ capability: "fs.read" }] };
    const result = resolveNodeSecurity("node-1", ctx);
    expect(result).toBe(ctx);
  });

  it("节点权限做交集", () => {
    const ctx: ResolvedSecurityContext = { runId: "run-1", actorType: "workflow", grants: [{ capability: "fs.read" }, { capability: "fs.write" }] };
    const result = resolveNodeSecurity("node-1", ctx, { permissions: [{ capability: "fs.read" }] });
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].capability).toBe("fs.read");
  });
});

describe("resolveAgentSecurity", () => {
  it("无 agent 权限时返回原上下文", () => {
    const ctx: ResolvedSecurityContext = { runId: "run-1", actorType: "workflow", grants: [{ capability: "fs.read" }] };
    const result = resolveAgentSecurity(ctx);
    expect(result).toBe(ctx);
  });

  it("agent 权限与父级做交集且 actorType 变为 agent", () => {
    const ctx: ResolvedSecurityContext = { runId: "run-1", actorType: "workflow", grants: [{ capability: "fs.read" }, { capability: "network.request" }] };
    const result = resolveAgentSecurity(ctx, [{ capability: "network.request" }]);
    expect(result.actorType).toBe("agent");
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].capability).toBe("network.request");
  });
});

describe("resolveSubWorkflowSecurity", () => {
  it("子 workflow 权限不能超出父级", () => {
    const parent: ResolvedSecurityContext = { runId: "parent", actorType: "workflow", grants: [{ capability: "fs.read" }] };
    const childConfig: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "fs.write" }],
    };
    const result = resolveSubWorkflowSecurity(parent, childConfig);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].capability).toBe("fs.read");
  });

  it("子 workflow 无配置时继承父级权限", () => {
    const parent: ResolvedSecurityContext = { runId: "parent", actorType: "workflow", grants: [{ capability: "fs.read" }] };
    const result = resolveSubWorkflowSecurity(parent);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].capability).toBe("fs.read");
  });

  it("记录的 inheritedFrom 正确", () => {
    const parent: ResolvedSecurityContext = { runId: "parent", actorType: "workflow", grants: [] };
    const result = resolveSubWorkflowSecurity(parent);
    expect(result.inheritedFrom).toBe("parent");
  });
});
