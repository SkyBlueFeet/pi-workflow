/**
 * 控制台执行器测试。
 */

import { describe, it, expect } from "vitest";
import {
  StudioExecutorImpl,
  renderExecutionResult,
  type ExecutionRequest,
} from "../src/console/studio-executor.js";

describe("StudioExecutorImpl", () => {
  it("骨架实现 execute 返回失败结果", async () => {
    const executor = new StudioExecutorImpl();
    const request: ExecutionRequest = {
      action: "workflow.run",
      targetId: "test-workflow",
      params: {},
    };
    const result = await executor.execute(request);
    expect(result.success).toBe(false);
    expect(result.action).toBe("workflow.run");
    expect(result.targetId).toBe("test-workflow");
    expect(result.error).toContain("尚未实现");
  });

  it("骨架实现 resume 返回失败结果", async () => {
    const executor = new StudioExecutorImpl();
    const result = await executor.resume("run-123");
    expect(result.success).toBe(false);
    expect(result.action).toBe("workflow.resume");
    expect(result.error).toContain("尚未实现");
  });

  it("支持所有执行动作类型", async () => {
    const executor = new StudioExecutorImpl();
    const actions: ExecutionRequest["action"][] = [
      "workflow.run",
      "workflow.resume",
      "workflow.trace",
      "workflow.inspect",
      "agent.run",
      "agent.once",
      "agent.resolve",
    ];

    for (const action of actions) {
      const result = await executor.execute({
        action,
        targetId: "test-target",
        params: {},
      });
      expect(result.action).toBe(action);
      expect(result.success).toBe(false); // 骨架均为 false
    }
  });
});

describe("renderExecutionResult", () => {
  it("渲染失败结果", () => {
    const output = renderExecutionResult({
      success: false,
      action: "workflow.run",
      targetId: "test",
      error: "未实现",
    });
    expect(output).toContain("执行失败");
    expect(output).toContain("未实现");
  });

  it("渲染成功结果", () => {
    const output = renderExecutionResult({
      success: true,
      action: "workflow.run",
      targetId: "test",
      runId: "run-001",
      output: "done",
    });
    expect(output).toContain("执行成功");
    expect(output).toContain("run-001");
    expect(output).toContain("done");
  });
});
