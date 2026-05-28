import { describe, expect, it, vi } from "vitest";
import { PiPermissionBridge } from "../../../src/adapters/pi/permission-bridge.js";

describe("PiPermissionBridge", () => {
  it("workflow 侧拒绝时直接返回 workflow 拒绝", async () => {
    const bridge = new PiPermissionBridge({
      piPermissionCheck: vi.fn().mockResolvedValue({ allowed: true }),
    });

    const result = await bridge.checkPermission("mcp.use", {
      permissions: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("[workflow]");
  });

  it("workflow 允许但 PI 拒绝时返回 PI 拒绝", async () => {
    const bridge = new PiPermissionBridge({
      piPermissionCheck: vi.fn().mockResolvedValue({ allowed: false, reason: "pi deny" }),
    });

    const result = await bridge.checkPermission("extension.execute", {
      permissions: [{ capability: "extension.execute" }],
    }, {
      piCapabilityName: "extension.execute",
      piResourceName: "writer",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("[PI]");
    expect(result.reason).toContain("pi deny");
  });

  it("workflow 与 PI 都允许时放行", async () => {
    const bridge = new PiPermissionBridge({
      piPermissionCheck: vi.fn().mockResolvedValue({ allowed: true }),
    });

    const result = await bridge.checkPermission("mcp.use", {
      permissions: [{ capability: "mcp.use", scope: { server: "ctx7" } }],
    }, {
      piCapabilityName: "mcp.use",
      piResourceName: "ctx7",
      scope: { server: "ctx7" },
    });

    expect(result.allowed).toBe(true);
  });
});
