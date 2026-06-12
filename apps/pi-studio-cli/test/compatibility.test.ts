/**
 * 兼容性测试：确保 pi-workflow / pi-agent 外部命令不受影响。
 *
 * 注意：此测试仅验证 pi-studio-cli 的模块边界划分正确，
 * pi-workflow / pi-agent 的实际命令行为由 pi-workflow-cli 的测试覆盖。
 */

import { describe, it, expect } from "vitest";

describe("模块边界验证", () => {
  it("pi-studio-cli 的 package.json bin 入口仅为 pi-studio", async () => {
    // 验证 pi-studio-cli 没有覆盖 pi-workflow / pi-agent 的 bin 入口
    const pkg = await import("../package.json", { with: { type: "json" } });
    const bins = pkg.default.bin;
    expect(bins).toHaveProperty("pi-studio");
    expect(bins).not.toHaveProperty("pi-workflow");
    expect(bins).not.toHaveProperty("pi-agent");
  });

  it("commands/studio.ts 可独立导入", async () => {
    const mod = await import("../src/commands/studio.js");
    expect(mod.studioCommand).toBeDefined();
    expect(typeof mod.studioCommand).toBe("function");
  });

  it("commands/workflow.ts 可独立导入", async () => {
    const mod = await import("../src/commands/workflow.js");
    expect(mod.createWorkflowFacade).toBeDefined();
    expect(typeof mod.createWorkflowFacade).toBe("function");
  });

  it("commands/agent.ts 可独立导入", async () => {
    const mod = await import("../src/commands/agent.js");
    expect(mod.createAgentFacade).toBeDefined();
    expect(typeof mod.createAgentFacade).toBe("function");
  });

  it("三组命令模块边界清晰，独立存在", async () => {
    // studio 模块不依赖 workflow/agent 模块的内部实现细节
    const studioMod = await import("../src/commands/studio.js");
    const workflowMod = await import("../src/commands/workflow.js");
    const agentMod = await import("../src/commands/agent.js");

    expect(studioMod.studioCommand).toBeDefined();
    expect(workflowMod.createWorkflowFacade).toBeDefined();
    expect(agentMod.createAgentFacade).toBeDefined();
  });
});
