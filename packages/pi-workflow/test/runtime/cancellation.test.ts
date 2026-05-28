import { describe, it, expect } from "vitest";
import { CancellationToken, CancelledError } from "../../src/runtime/cancellation.js";

describe("CancellationToken", () => {
  it("初始状态未取消", () => {
    const token = new CancellationToken();
    expect(token.isCancelled).toBe(false);
  });

  it("cancel 后 isCancelled 为 true", () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
  });

  it("cancel 后立即触发注册的回调", () => {
    const token = new CancellationToken();
    let called = false;
    token.onCancelled(() => { called = true; });
    token.cancel();
    expect(called).toBe(true);
  });

  it("throwIfCancelled 在取消后抛出 CancelledError", () => {
    const token = new CancellationToken();
    token.cancel();
    expect(() => token.throwIfCancelled()).toThrow(CancelledError);
  });
});
