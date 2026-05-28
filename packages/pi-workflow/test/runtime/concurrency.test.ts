import { describe, it, expect } from "vitest";
import { ConcurrencyLimiter } from "../../src/runtime/concurrency.js";

describe("ConcurrencyLimiter", () => {
  it("限制并发数", async () => {
    const limiter = new ConcurrencyLimiter(2);
    let maxActive = 0;
    let active = 0;

    const tasks = Array.from({ length: 5 }, (_, i) =>
      limiter.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 20));
        active--;
        return i;
      }),
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("queuedCount 跟踪排队数", async () => {
    const limiter = new ConcurrencyLimiter(1);

    const slowTask = limiter.run(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    await new Promise(r => setTimeout(r, 5));
    expect(limiter.activeCount).toBe(1);

    const fastTask = limiter.run(async () => "done");
    expect(limiter.queuedCount).toBe(1);

    await slowTask;
    const result = await fastTask;
    expect(result).toBe("done");
  });
});
