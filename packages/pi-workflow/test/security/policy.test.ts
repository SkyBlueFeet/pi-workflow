import { describe, it, expect } from "vitest";
import { evaluateCapability, mergePolicies, defaultSecurityConfig, isCapabilityAllowed } from "../../src/security/policy.js";
import type { WorkflowSecurityConfig } from "../../src/security/types.js";

describe("evaluateCapability", () => {
  it("无安全配置时高风险能力拒绝", () => {
    const result = evaluateCapability(undefined, "fs.write");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("默认安全策略");
  });

  it("无安全配置时低风险能力放行", () => {
    const result = evaluateCapability(undefined, "workflow.invoke");
    expect(result.allowed).toBe(true);
  });

  it("声明的权限允许", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.write" }],
    };
    const result = evaluateCapability(config, "fs.write");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("权限已授权");
  });

  it("未声明的权限拒绝", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }],
    };
    const result = evaluateCapability(config, "fs.write");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("未授权");
  });

  it("allow-known-safe 模式放行低风险能力", () => {
    const config: WorkflowSecurityConfig = {
      defaultMode: "allow-known-safe",
    };
    const result = evaluateCapability(config, "fs.read");
    expect(result.allowed).toBe(true);
  });

  it("allow-known-safe 模式仍拒绝高风险能力", () => {
    const config: WorkflowSecurityConfig = {
      defaultMode: "allow-known-safe",
    };
    const result = evaluateCapability(config, "process.execute");
    expect(result.allowed).toBe(false);
  });

  it("scope 匹配时授权", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read", scope: { path: "/tmp" } }],
    };
    const result = evaluateCapability(config, "fs.read", { path: "/tmp" });
    expect(result.allowed).toBe(true);
  });

  it("scope 不匹配时拒绝", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read", scope: { path: "/tmp" } }],
    };
    const result = evaluateCapability(config, "fs.read", { path: "/etc" });
    expect(result.allowed).toBe(false);
  });
});

describe("mergePolicies", () => {
  it("子权限是父权限的子集时保留", () => {
    const parent: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "fs.write" }],
    };
    const child: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }],
    };
    const merged = mergePolicies(parent, child);
    expect(merged.permissions).toHaveLength(1);
    expect(merged.permissions![0].capability).toBe("fs.read");
  });

  it("子权限超出父级时被截断", () => {
    const parent: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }],
    };
    const child: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "fs.write" }],
    };
    const merged = mergePolicies(parent, child);
    expect(merged.permissions).toHaveLength(1);
  });

  it("parent 为 undefined 时以 child 为准", () => {
    const child: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }],
    };
    const merged = mergePolicies(undefined, child);
    expect(merged.permissions).toHaveLength(1);
  });

  it("子权限与父权限无交集时返回空（不能提权）", () => {
    const parent: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }],
    };
    const child: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.write" }],
    };
    const merged = mergePolicies(parent, child);
    expect(merged.permissions).toHaveLength(0);
  });

  it("子继承父默认模式", () => {
    const parent: WorkflowSecurityConfig = {
      defaultMode: "allow-known-safe",
    };
    const merged = mergePolicies(parent, undefined);
    expect(merged.defaultMode).toBe("allow-known-safe");
  });
});

describe("defaultSecurityConfig", () => {
  it("返回 deny 默认配置", () => {
    const config = defaultSecurityConfig();
    expect(config.defaultMode).toBe("deny");
    expect(config.permissions).toEqual([]);
    expect(config.audit?.enabled).toBe(true);
    expect(config.audit?.includeDenyDecisions).toBe(true);
    expect(config.audit?.includeAllowDecisions).toBe(false);
  });
});

describe("isCapabilityAllowed", () => {
  it("返回 boolean 简洁版", () => {
    expect(isCapabilityAllowed(undefined, "fs.write")).toBe(false);
    expect(isCapabilityAllowed(undefined, "workflow.invoke")).toBe(true);
    const config: WorkflowSecurityConfig = { permissions: [{ capability: "fs.write" }] };
    expect(isCapabilityAllowed(config, "fs.write")).toBe(true);
    expect(isCapabilityAllowed(config, "fs.read")).toBe(false);
  });
});
