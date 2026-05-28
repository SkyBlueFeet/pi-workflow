import { describe, it, expect } from "vitest";
import {
  isHighRisk,
  isKnownSafe,
  grantMatches,
  findGrant,
  mergeGrants,
  intersectGrants,
  HIGH_RISK_CAPABILITIES,
} from "../../src/security/permissions.js";
import type { PermissionGrant } from "../../src/security/types.js";

describe("isHighRisk", () => {
  it("fs.write 是高危", () => {
    expect(isHighRisk("fs.write")).toBe(true);
  });

  it("process.execute 是高危", () => {
    expect(isHighRisk("process.execute")).toBe(true);
  });

  it("fs.read 不是高危", () => {
    expect(isHighRisk("fs.read")).toBe(false);
  });

  it("workflow.invoke 不是高危", () => {
    expect(isHighRisk("workflow.invoke")).toBe(false);
  });
});

describe("isKnownSafe", () => {
  it("fs.read 是安全能力", () => {
    expect(isKnownSafe("fs.read")).toBe(true);
  });

  it("process.execute 不是安全能力", () => {
    expect(isKnownSafe("process.execute")).toBe(false);
  });
});

describe("grantMatches", () => {
  it("相同 capability 且无 scope 匹配", () => {
    const grant: PermissionGrant = { capability: "fs.read" };
    expect(grantMatches(grant, "fs.read")).toBe(true);
  });

  it("不同 capability 不匹配", () => {
    const grant: PermissionGrant = { capability: "fs.read" };
    expect(grantMatches(grant, "fs.write")).toBe(false);
  });

  it("有 scope 时精确匹配", () => {
    const grant: PermissionGrant = { capability: "fs.read", scope: { path: "/tmp" } };
    expect(grantMatches(grant, "fs.read", { path: "/tmp" })).toBe(true);
  });

  it("scope 不匹配时返回 false", () => {
    const grant: PermissionGrant = { capability: "fs.read", scope: { path: "/tmp" } };
    expect(grantMatches(grant, "fs.read", { path: "/etc" })).toBe(false);
  });

  it("grant 无 scope 但请求有 scope 时仍匹配", () => {
    const grant: PermissionGrant = { capability: "fs.read" };
    expect(grantMatches(grant, "fs.read", { path: "/tmp" })).toBe(true);
  });
});

describe("findGrant", () => {
  it("找到匹配的 grant", () => {
    const grants: readonly PermissionGrant[] = [
      { capability: "fs.read" },
      { capability: "fs.write" },
    ];
    const found = findGrant(grants, "fs.write");
    expect(found).toBeDefined();
    expect(found!.capability).toBe("fs.write");
  });

  it("找不到时返回 undefined", () => {
    const grants: readonly PermissionGrant[] = [{ capability: "fs.read" }];
    expect(findGrant(grants, "network.request")).toBeUndefined();
  });
});

describe("mergeGrants", () => {
  it("合并多个来源的 grants", () => {
    const a: readonly PermissionGrant[] = [{ capability: "fs.read" }];
    const b: readonly PermissionGrant[] = [{ capability: "fs.write" }];
    const merged = mergeGrants(a, b);
    expect(merged).toHaveLength(2);
  });

  it("重复的 grants 去重", () => {
    const a: readonly PermissionGrant[] = [{ capability: "fs.read" }];
    const b: readonly PermissionGrant[] = [{ capability: "fs.read" }];
    const merged = mergeGrants(a, b);
    expect(merged).toHaveLength(1);
  });
});

describe("intersectGrants", () => {
  it("返回交集", () => {
    const upper: readonly PermissionGrant[] = [
      { capability: "fs.read" },
      { capability: "fs.write" },
    ];
    const lower: readonly PermissionGrant[] = [
      { capability: "fs.read" },
      { capability: "network.request" },
    ];
    const result = intersectGrants(upper, lower);
    expect(result).toHaveLength(1);
    expect(result[0].capability).toBe("fs.read");
  });

  it("无交集时返回空数组", () => {
    const upper: readonly PermissionGrant[] = [{ capability: "fs.read" }];
    const lower: readonly PermissionGrant[] = [{ capability: "fs.write" }];
    expect(intersectGrants(upper, lower)).toHaveLength(0);
  });
});

describe("HIGH_RISK_CAPABILITIES", () => {
  it("包含预期的高危能力", () => {
    expect(HIGH_RISK_CAPABILITIES).toContain("fs.write");
    expect(HIGH_RISK_CAPABILITIES).toContain("process.execute");
    expect(HIGH_RISK_CAPABILITIES).toContain("network.request");
    expect(HIGH_RISK_CAPABILITIES).toContain("extension.execute");
    expect(HIGH_RISK_CAPABILITIES).toContain("mcp.use");
    expect(HIGH_RISK_CAPABILITIES).not.toContain("fs.read");
    expect(HIGH_RISK_CAPABILITIES).not.toContain("workflow.invoke");
  });
});
