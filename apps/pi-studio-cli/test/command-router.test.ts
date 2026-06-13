/**
 * 控制台 slash command 路由测试。
 */

import { describe, it, expect } from "vitest";
import {
  parseInput,
  isStudioCommand,
  STUDIO_COMMANDS,
  createDefaultRouter,
} from "../src/console/studio-command-router.js";
import { createInitialState } from "../src/console/studio-state.js";

describe("parseInput", () => {
  it("识别 /help 为 slash command", () => {
    const result = parseInput("/help");
    expect(result.isCommand).toBe(true);
    if (result.isCommand) {
      expect(result.command).toBe("/help");
      expect(result.args).toEqual([]);
    }
  });

  it("识别带参数的 slash command", () => {
    const result = parseInput("/workflows --filter test");
    expect(result.isCommand).toBe(true);
    if (result.isCommand) {
      expect(result.command).toBe("/workflows");
      expect(result.args).toEqual(["--filter", "test"]);
    }
  });

  it("将普通文本识别为自然语言", () => {
    const result = parseInput("帮我创建一个 workflow");
    expect(result.isCommand).toBe(false);
    if (!result.isCommand) {
      expect(result.text).toBe("帮我创建一个 workflow");
    }
  });

  it("大小写不敏感", () => {
    const result = parseInput("/Workflows");
    expect(result.isCommand).toBe(true);
    if (result.isCommand) {
      expect(result.command).toBe("/workflows");
    }
  });
});

describe("isStudioCommand", () => {
  it("已知命令返回 true", () => {
    expect(isStudioCommand("/help")).toBe(true);
    expect(isStudioCommand("/workflows")).toBe(true);
    expect(isStudioCommand("/agents")).toBe(true);
    expect(isStudioCommand("/skills")).toBe(true);
    expect(isStudioCommand("/tools")).toBe(true);
    expect(isStudioCommand("/resources")).toBe(true);
    expect(isStudioCommand("/runs")).toBe(true);
    expect(isStudioCommand("/create-workflow")).toBe(true);
    expect(isStudioCommand("/create-agent")).toBe(true);
    expect(isStudioCommand("/exit")).toBe(true);
    expect(isStudioCommand("/quit")).toBe(true);
  });

  it("未知命令返回 false", () => {
    expect(isStudioCommand("/unknown")).toBe(false);
    expect(isStudioCommand("/foo")).toBe(false);
    expect(isStudioCommand("not-a-command")).toBe(false);
  });
});

describe("STUDIO_COMMANDS", () => {
  it("包含所有第一阶段正式命令", () => {
    expect(STUDIO_COMMANDS).toContain("/help");
    expect(STUDIO_COMMANDS).toContain("/workflows");
    expect(STUDIO_COMMANDS).toContain("/agents");
    expect(STUDIO_COMMANDS).toContain("/skills");
    expect(STUDIO_COMMANDS).toContain("/tools");
    expect(STUDIO_COMMANDS).toContain("/resources");
    expect(STUDIO_COMMANDS).toContain("/runs");
    expect(STUDIO_COMMANDS).toContain("/create-workflow");
    expect(STUDIO_COMMANDS).toContain("/create-agent");
    expect(STUDIO_COMMANDS).toContain("/exit");
    expect(STUDIO_COMMANDS).toContain("/quit");
    expect(STUDIO_COMMANDS).toHaveLength(11);
  });
});

describe("createDefaultRouter", () => {
  it("创建包含所有命令的路由表", () => {
    const router = createDefaultRouter();
    for (const cmd of STUDIO_COMMANDS) {
      expect(router.has(cmd)).toBe(true);
    }
  });
});

describe("command handlers", () => {
  it("/help 切换到 help 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/help")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("help");
  });

  it("/workflows 切换到 workflows 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/workflows")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("workflows");
    expect(result.output).toBeDefined();
    expect(result.state.payload).toBeDefined();
  });

  it("/agents 切换到 agents 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/agents")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("agents");
    expect(result.state.payload).toBeDefined();
  });

  it("/create-workflow 切换到 create-workflow 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/create-workflow")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("create-workflow");
    expect(result.output).toContain("AI 生成链路");
  });

  it("/create-agent 切换到 create-agent 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/create-agent")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("create-agent");
    expect(result.output).toContain("AI 生成链路");
  });

  it("/skills 切换到 skills 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/skills")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("skills");
  });

  it("/tools 切换到 tools 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/tools")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("tools");
  });

  it("/resources 切换到 resources 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/resources")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("resources");
  });

  it("/runs 切换到 runs 视图", () => {
    const router = createDefaultRouter();
    const handler = router.get("/runs")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.state.view).toBe("runs");
  });

  it("/exit 返回 exit 信号", () => {
    const router = createDefaultRouter();
    const handler = router.get("/exit")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.exit).toBe(true);
  });

  it("/quit 返回 exit 信号", () => {
    const router = createDefaultRouter();
    const handler = router.get("/quit")!;
    const state = createInitialState();
    const result = handler(state, []);
    expect(result.exit).toBe(true);
  });
});
