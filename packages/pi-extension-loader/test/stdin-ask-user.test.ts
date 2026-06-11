import { afterEach, describe, expect, it, vi } from "vitest";

describe("stdinAskUser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("将单选编号输入解析为对应选项标签", async () => {
    const questionMock = vi.fn((_prompt: string, callback: (answer: string) => void) => callback("1"));
    const closeMock = vi.fn();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.doMock("node:readline", () => ({
      createInterface: () => ({
        question: questionMock,
        close: closeMock,
      }),
    }));

    const { stdinAskUser } = await import("../src/stdin-ask-user.js?parse-single-choice");
    const result = await stdinAskUser({
      questions: [
        {
          header: "权限确认",
          question: "是否允许继续执行？",
          options: [
            { label: "允许一次", description: "本次允许" },
            { label: "拒绝", description: "拒绝执行" },
          ],
        },
      ],
    });

    expect(questionMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(result.content).toContain("允许一次");
    logSpy.mockRestore();
  });
});
