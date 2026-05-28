import { describe, it, expect } from "vitest";
import { SecurityAuditor } from "../../src/security/auditor.js";

describe("SecurityAuditor", () => {
  it("记录 deny 事件", () => {
    const auditor = new SecurityAuditor();
    auditor.record("run-1", "fs.write", "deny", "未授权", { nodeId: "node-1", actorType: "workflow" });
    const events = auditor.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].decision).toBe("deny");
    expect(events[0].capability).toBe("fs.write");
    expect(events[0].reason).toBe("未授权");
    expect(events[0].nodeId).toBe("node-1");
    expect(events[0].runId).toBe("run-1");
    expect(events[0].timestamp).toBeTruthy();
  });

  it("记录 allow 事件 (当启用时)", () => {
    const auditor = new SecurityAuditor({ enabled: true, includeAllowDecisions: true, includeDenyDecisions: false });
    auditor.record("run-1", "fs.read", "allow", "已授权");
    const events = auditor.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].decision).toBe("allow");
  });

  it("不记录 allow 事件 (当禁用时)", () => {
    const auditor = new SecurityAuditor({ enabled: true, includeAllowDecisions: false, includeDenyDecisions: true });
    auditor.record("run-1", "fs.read", "allow", "已授权");
    expect(auditor.getEvents()).toHaveLength(0);
  });

  it("不记录 deny 事件 (当禁用时)", () => {
    const auditor = new SecurityAuditor({ enabled: true, includeAllowDecisions: true, includeDenyDecisions: false });
    auditor.record("run-1", "fs.write", "deny", "未授权");
    expect(auditor.getEvents()).toHaveLength(0);
  });

  it("disabled 时不记录", () => {
    const auditor = new SecurityAuditor({ enabled: false });
    auditor.record("run-1", "fs.write", "deny", "未授权");
    expect(auditor.getEvents()).toHaveLength(0);
  });

  it("getDenyEvents 仅返回拒绝事件", () => {
    const auditor = new SecurityAuditor({ enabled: true, includeAllowDecisions: true, includeDenyDecisions: true });
    auditor.record("run-1", "fs.read", "allow", "已授权");
    auditor.record("run-1", "fs.write", "deny", "未授权");
    const denies = auditor.getDenyEvents();
    expect(denies).toHaveLength(1);
    expect(denies[0].decision).toBe("deny");
  });

  it("hasDenials 判断正确", () => {
    const auditor = new SecurityAuditor();
    expect(auditor.hasDenials()).toBe(false);
    auditor.record("run-1", "fs.write", "deny", "未授权");
    expect(auditor.hasDenials()).toBe(true);
  });

  it("clear 清空事件", () => {
    const auditor = new SecurityAuditor();
    auditor.record("run-1", "fs.write", "deny", "未授权");
    expect(auditor.getEvents()).toHaveLength(1);
    auditor.clear();
    expect(auditor.getEvents()).toHaveLength(0);
  });

  it("默认配置记录 deny 但不记录 allow", () => {
    const auditor = new SecurityAuditor();
    auditor.record("run-1", "fs.read", "allow", "已授权");
    auditor.record("run-1", "fs.write", "deny", "未授权");
    expect(auditor.getEvents()).toHaveLength(1);
    expect(auditor.getEvents()[0].decision).toBe("deny");
  });

  it("记录的事件包含完整上下文", () => {
    const auditor = new SecurityAuditor({ enabled: true, includeAllowDecisions: true, includeDenyDecisions: true });
    auditor.record("run-1", "mcp.use", "allow", "PI 侧允许", { nodeId: "mcp-1", actorType: "agent" });
    const event = auditor.getEvents()[0];
    expect(event.runId).toBe("run-1");
    expect(event.nodeId).toBe("mcp-1");
    expect(event.actorType).toBe("agent");
    expect(event.capability).toBe("mcp.use");
    expect(event.decision).toBe("allow");
    expect(event.reason).toBe("PI 侧允许");
    expect(event.timestamp).toBeTruthy();
  });

  it("getEventsByRun 按 runId 过滤", () => {
    const auditor = new SecurityAuditor();
    auditor.record("run-1", "fs.write", "deny", "拒绝");
    auditor.record("run-2", "network.request", "deny", "拒绝");
    expect(auditor.getEventsByRun("run-1")).toHaveLength(1);
    expect(auditor.getEventsByRun("run-1")[0].runId).toBe("run-1");
    expect(auditor.getEventsByRun("run-2")).toHaveLength(1);
    expect(auditor.getEventsByRun("run-3")).toHaveLength(0);
  });

  it("clearRun 只清理指定 runId", () => {
    const auditor = new SecurityAuditor();
    auditor.record("run-1", "fs.write", "deny", "拒绝");
    auditor.record("run-2", "network.request", "deny", "拒绝");
    auditor.clearRun("run-1");
    expect(auditor.getEvents()).toHaveLength(1);
    expect(auditor.getEvents()[0].runId).toBe("run-2");
  });
});
