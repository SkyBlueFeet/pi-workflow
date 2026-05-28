import { describe, it, expect } from "vitest";
import { HeadlessExtensionAPI } from "../src/headless-extension-api.js";

describe("HeadlessExtensionAPI", () => {
  it("registerTool 捕获工具定义", () => {
    const api = new HeadlessExtensionAPI();
    api.registerTool({ name: "my_tool", description: "does something" });
    expect(api.tools).toHaveLength(1);
    expect(api.tools[0].name).toBe("my_tool");
  });

  it("registerTool 可捕获多个工具", () => {
    const api = new HeadlessExtensionAPI();
    api.registerTool({ name: "a" });
    api.registerTool({ name: "b" });
    api.registerTool({ name: "c" });
    expect(api.tools).toHaveLength(3);
  });

  it("registerTool 保持完整定义", () => {
    const api = new HeadlessExtensionAPI();
    const def = { name: "x", description: "desc", parameters: { type: "object" }, execute: async () => ({}) };
    api.registerTool(def);
    expect(api.tools[0].name).toBe("x");
    expect(api.tools[0].description).toBe("desc");
    expect(api.tools[0].parameters).toEqual({ type: "object" });
    expect(typeof api.tools[0].execute).toBe("function");
  });

  it("getAllTools 返回所有捕获的工具信息", () => {
    const api = new HeadlessExtensionAPI();
    api.registerTool({ name: "t1" });
    api.registerTool({ name: "t2" });
    const all = api.getAllTools();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe("t1");
    expect(all[1].name).toBe("t2");
  });

  it("registerCommand 不抛异常", () => {
    const api = new HeadlessExtensionAPI();
    expect(() => api.registerCommand("cmd", {})).not.toThrow();
  });

  it("registerShortcut 不抛异常", () => {
    const api = new HeadlessExtensionAPI();
    expect(() => api.registerShortcut("ctrl+k", { description: "", handler: async () => {} })).not.toThrow();
  });

  it("registerFlag 不抛异常", () => {
    const api = new HeadlessExtensionAPI();
    expect(() => api.registerFlag("verbose", { description: "", type: "boolean" })).not.toThrow();
  });

  it("getFlag 返回 undefined", () => {
    const api = new HeadlessExtensionAPI();
    expect(api.getFlag("any")).toBeUndefined();
  });

  it("on 不抛异常", () => {
    const api = new HeadlessExtensionAPI();
    expect(() => api.on("session_start", async () => {})).not.toThrow();
  });

  it("events.emit 不抛异常", () => {
    const api = new HeadlessExtensionAPI();
    expect(() => api.events.emit("test_event", { data: 1 })).not.toThrow();
  });

  it("exec 返回空结果", async () => {
    const api = new HeadlessExtensionAPI();
    const result = await api.exec("echo", ["hi"]);
    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("setModel 返回 false", async () => {
    const api = new HeadlessExtensionAPI();
    const ok = await api.setModel({});
    expect(ok).toBe(false);
  });

  it("getActiveTools 返回空数组", () => {
    const api = new HeadlessExtensionAPI();
    expect(api.getActiveTools()).toEqual([]);
  });

});
