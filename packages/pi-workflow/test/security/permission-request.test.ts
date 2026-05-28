import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPermissionApproval } from "../../src/security/permission-request.js";
import { clearRunScopedApprovals } from "../../src/security/approval-store.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  clearRunScopedApprovals("run-1");
  clearRunScopedApprovals("run-2");
});

describe("requestPermissionApproval", () => {
  it("允许本次运行后，后续同运行直接命中缓存", async () => {
    const requestUserInput = vi.fn().mockResolvedValue({
      input: { answer: "允许本次运行", selected: "允许本次运行" },
    });

    const first = await requestPermissionApproval({
      runId: "run-1",
      nodeId: "node-1",
      capability: "workflow.invoke",
      reason: "need workflow",
      actorLabel: "测试节点",
      resource: "summarize",
      requestUserInput,
    });
    const second = await requestPermissionApproval({
      runId: "run-1",
      nodeId: "node-1",
      capability: "workflow.invoke",
      reason: "need workflow",
      actorLabel: "测试节点",
      resource: "summarize",
      requestUserInput,
    });

    expect(first).toEqual({ granted: true, mode: "allow-run" });
    expect(second).toEqual({ granted: true, mode: "preapproved-run" });
    expect(requestUserInput).toHaveBeenCalledTimes(1);
  });

  it("永久允许后写入 trust-policy.json，并在后续直接命中", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-workflow-security-"));
    tempDirs.push(cwd);
    const requestUserInput = vi.fn().mockResolvedValue({
      input: { answer: "永久允许", selected: "永久允许" },
    });

    const first = await requestPermissionApproval({
      runId: "run-2",
      nodeId: "node-1",
      capability: "mcp.use",
      reason: "need mcp",
      actorLabel: "测试智能体",
      resource: "ctx7",
      cwd,
      requestUserInput,
    });
    const second = await requestPermissionApproval({
      runId: "run-3",
      nodeId: "node-1",
      capability: "mcp.use",
      reason: "need mcp",
      actorLabel: "测试智能体",
      resource: "ctx7",
      cwd,
      requestUserInput,
    });

    const trustPolicyPath = join(cwd, ".pi-workflow", "trust-policy.json");
    const persisted = JSON.parse(readFileSync(trustPolicyPath, "utf-8")) as {
      securityPermissions?: Array<{ capability: string; resource: string }>;
    };

    expect(first).toEqual({ granted: true, mode: "allow-persist" });
    expect(second).toEqual({ granted: true, mode: "preapproved-persist" });
    expect(persisted.securityPermissions).toHaveLength(1);
    expect(persisted.securityPermissions?.[0]).toMatchObject({
      capability: "mcp.use",
      resource: "mcp.use:ctx7",
    });
    expect(requestUserInput).toHaveBeenCalledTimes(1);
  });
});
