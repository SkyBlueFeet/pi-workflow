/**
 * 控制台状态模型测试。
 */

import { describe, it, expect } from "vitest";
import {
  createInitialState,
  navigateTo,
  setInputMode,
  addMessage,
  setLoading,
  setPayload,
  setError,
  clearError,
  type ConsoleView,
} from "../src/console/studio-state.js";

describe("createInitialState", () => {
  it("创建状态为 home 视图", () => {
    const state = createInitialState();
    expect(state.view).toBe("home");
  });

  it("默认输入模式为 shell", () => {
    const state = createInitialState();
    expect(state.inputMode).toBe("shell");
  });

  it("初始状态 loading 为 false", () => {
    const state = createInitialState();
    expect(state.loading).toBe(false);
  });

  it("初始消息列表为空", () => {
    const state = createInitialState();
    expect(state.messages).toEqual([]);
  });

  it("初始无错误", () => {
    const state = createInitialState();
    expect(state.lastError).toBeNull();
  });

  it("初始 payload 为 null", () => {
    const state = createInitialState();
    expect(state.payload).toBeNull();
  });
});

describe("navigateTo", () => {
  it("切换视图并清除错误和 payload", () => {
    const state = createInitialState();
    const next = navigateTo(state, "workflows");
    expect(next.view).toBe("workflows");
    expect(next.payload).toBeNull();
    expect(next.lastError).toBeNull();
  });

  it("支持所有已知视图", () => {
    const views: ConsoleView[] = [
      "home",
      "workflows",
      "agents",
      "skills",
      "tools",
      "resources",
      "runs",
      "create-workflow",
      "create-agent",
      "help",
    ];

    for (const view of views) {
      const state = createInitialState();
      const next = navigateTo(state, view);
      expect(next.view).toBe(view);
    }
  });
});

describe("setInputMode", () => {
  it("切换到 assistant 模式", () => {
    const state = createInitialState();
    const next = setInputMode(state, "assistant");
    expect(next.inputMode).toBe("assistant");
  });

  it("切换回 shell 模式", () => {
    let state = createInitialState();
    state = setInputMode(state, "assistant");
    state = setInputMode(state, "shell");
    expect(state.inputMode).toBe("shell");
  });
});

describe("addMessage", () => {
  it("添加消息到历史", () => {
    const state = createInitialState();
    const next = addMessage(state, {
      role: "user",
      content: "test",
      timestamp: new Date(),
    });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0].role).toBe("user");
    expect(next.messages[0].content).toBe("test");
  });

  it("不修改原状态", () => {
    const state = createInitialState();
    addMessage(state, {
      role: "user",
      content: "test",
      timestamp: new Date(),
    });
    expect(state.messages).toHaveLength(0);
  });
});

describe("setLoading", () => {
  it("设置 loading 为 true", () => {
    const state = createInitialState();
    const next = setLoading(state, true);
    expect(next.loading).toBe(true);
  });

  it("设置 loading 为 false", () => {
    const state = createInitialState();
    const next = setLoading(setLoading(state, true), false);
    expect(next.loading).toBe(false);
  });
});

describe("setPayload", () => {
  it("设置 payload 值", () => {
    const state = createInitialState();
    const next = setPayload(state, { key: "value" });
    expect(next.payload).toEqual({ key: "value" });
  });

  it("支持列表 payload", () => {
    const state = createInitialState();
    const next = setPayload(state, ["a", "b", "c"]);
    expect(next.payload).toEqual(["a", "b", "c"]);
  });
});

describe("setError / clearError", () => {
  it("设置错误信息", () => {
    const state = createInitialState();
    const next = setError(state, "something went wrong");
    expect(next.lastError).toBe("something went wrong");
    expect(next.loading).toBe(false);
  });

  it("清除错误信息", () => {
    let state = createInitialState();
    state = setError(state, "test error");
    state = clearError(state);
    expect(state.lastError).toBeNull();
  });
});
