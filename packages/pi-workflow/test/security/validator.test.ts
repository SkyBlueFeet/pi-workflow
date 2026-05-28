import { describe, it, expect } from "vitest";
import { validateSecurityConfig, validateNodeSecurityPermissions, checkHighRiskNodeHasPermission } from "../../src/security/validator.js";
import type { WorkflowSecurityConfig } from "../../src/security/types.js";

describe("validateSecurityConfig", () => {
  it("undefined config 产生 warning 但 valid", () => {
    const result = validateSecurityConfig(undefined);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].field).toBe("security");
  });

  it("空 security 配置通过", () => {
    const result = validateSecurityConfig({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("未知权限类型报错", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "unknown.capability" as any }],
    };
    const result = validateSecurityConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("未知权限类型");
  });

  it("合法权限通过", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read" }, { capability: "network.request" }],
    };
    const result = validateSecurityConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("allow-known-safe 但无权限时产生 warning", () => {
    const config: WorkflowSecurityConfig = {
      defaultMode: "allow-known-safe",
    };
    const result = validateSecurityConfig(config);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("scope 不是对象时报错", () => {
    const config: WorkflowSecurityConfig = {
      permissions: [{ capability: "fs.read", scope: "invalid" as any }],
    };
    const result = validateSecurityConfig(config);
    expect(result.valid).toBe(false);
  });
});

describe("validateNodeSecurityPermissions", () => {
  it("无节点权限时通过", () => {
    const result = validateNodeSecurityPermissions("node-1", "agent", undefined, { permissions: [{ capability: "fs.read" }] });
    expect(result.valid).toBe(true);
  });

  it("节点权限未在父级声明时报错", () => {
    const result = validateNodeSecurityPermissions("node-1", "agent", { permissions: [{ capability: "fs.write" }] }, { permissions: [{ capability: "fs.read" }] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("超出父级范围");
  });

  it("父级无任何权限时节点声明报错", () => {
    const result = validateNodeSecurityPermissions("node-1", "agent", { permissions: [{ capability: "fs.read" }] }, { permissions: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("未声明任何权限");
  });

  it("节点权限在父级范围内时通过", () => {
    const result = validateNodeSecurityPermissions("node-1", "agent", { permissions: [{ capability: "fs.read" }, { capability: "network.request" }] }, { permissions: [{ capability: "fs.read" }, { capability: "network.request" }, { capability: "fs.write" }] });
    expect(result.valid).toBe(true);
  });
});

describe("checkHighRiskNodeHasPermission", () => {
  it("http 节点需要 network.request", () => {
    const result = checkHighRiskNodeHasPermission("http-1", "http", {
      permissions: [{ capability: "fs.read" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("network.request");
  });

  it("manual 节点不需要检查", () => {
    const result = checkHighRiskNodeHasPermission("manual-1", "manual", undefined);
    expect(result.valid).toBe(true);
  });

  it("http 节点有 network.request 时通过", () => {
    const result = checkHighRiskNodeHasPermission("http-1", "http", {
      permissions: [{ capability: "network.request" }],
    });
    expect(result.valid).toBe(true);
  });

  it("tool 节点需要 process.execute", () => {
    const result = checkHighRiskNodeHasPermission("tool-1", "tool", undefined);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("process.execute");
  });

  it("tool 节点有 process.execute 时通过", () => {
    const result = checkHighRiskNodeHasPermission("tool-1", "tool", {
      permissions: [{ capability: "process.execute" }],
    });
    expect(result.valid).toBe(true);
  });
});
