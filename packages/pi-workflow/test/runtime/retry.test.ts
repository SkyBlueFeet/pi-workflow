import { describe, it, expect } from "vitest";
import { withRetry } from "../../src/runtime/retry.js";

describe("withRetry", () => {
  it("第一次成功直接返回", async () => {
    const result = await withRetry(
      () => Promise.resolve("ok"),
      { maxAttempts: 3, delayMs: 10 },
    );
    expect(result).toBe("ok");
  });

  it("重试后成功返回结果", async () => {
    let attempts = 0;
    const result = await withRetry(
      () => {
        attempts++;
        if (attempts < 3) throw new Error("not yet");
        return Promise.resolve("finally-ok");
      },
      { maxAttempts: 3, delayMs: 10 },
    );
    expect(result).toBe("finally-ok");
    expect(attempts).toBe(3);
  });

  it("所有重试失败后抛出最后一次错误", async () => {
    await expect(
      withRetry(
        () => Promise.reject(new Error("always-fail")),
        { maxAttempts: 2, delayMs: 10 },
      ),
    ).rejects.toThrow("always-fail");
  });
});
