/**
 * pi-studio CLI 入口测试。
 */

import { describe, it, expect, vi, afterEach } from "vitest";

describe("pi-studio CLI 入口", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    consoleLogSpy?.mockRestore();
  });

  it("默认显示 help 信息", async () => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { studioCommand } = await import("../src/commands/studio.js");

    // 不带任何参数
    await studioCommand([]);

    const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(calls).toContain("pi-studio");
    expect(calls).toContain("产品级宿主入口");
  });

  it("--help 显示 help 信息", async () => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { studioCommand } = await import("../src/commands/studio.js");

    await studioCommand(["--help"]);

    const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(calls).toContain("--console 进入宿主级控制台");
  });

  it("-h 显示 help 信息", async () => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { studioCommand } = await import("../src/commands/studio.js");

    await studioCommand(["-h"]);

    const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(calls).toContain("pi-studio");
  });

  it("help 信息包含相关命令提示", async () => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { studioCommand } = await import("../src/commands/studio.js");

    await studioCommand([]);

    const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(calls).toContain("pi-workflow");
    expect(calls).toContain("pi-agent");
  });
});
