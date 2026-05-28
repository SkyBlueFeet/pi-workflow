import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "../../src/runtime/timeout.js";

describe("withTimeout", () => {
  it("在超时前完成返回结果", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      1000,
    );
    expect(result).toBe("ok");
  });

  it("超时时抛出 TimeoutError", async () => {
    await expect(
      withTimeout(
        new Promise(resolve => setTimeout(() => resolve("too-late"), 500)),
        50,
      ),
    ).rejects.toThrow(TimeoutError);
  });
});
