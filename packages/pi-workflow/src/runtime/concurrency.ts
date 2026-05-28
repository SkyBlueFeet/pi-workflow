/** 并发限制器，控制同时执行的任务数量，支持队列和取消 */
export class ConcurrencyLimiter {
  private active = 0;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private max: number;
  private aborted = false;

  /**
   * @param max - 最大并发数（至少为 1）
   */
  constructor(max: number) {
    this.max = Math.max(1, max);
  }

  /** 当前活跃的任务数 */
  get activeCount(): number {
    return this.active;
  }

  /** 当前排队等待的任务数 */
  get queuedCount(): number {
    return this.queue.length;
  }

  /** 取消所有排队的任务并清空队列 */
  cancel(reason?: string): void {
    this.aborted = true;
    const err = new Error(reason ?? "ConcurrencyLimiter cancelled");
    while (this.queue.length > 0) {
      this.queue.shift()!.reject(err);
    }
  }

  /**
   * 执行一个异步函数，受并发数和取消信号控制
   * @param fn - 待执行的异步函数
   * @param signal - 可选的中止信号，排队或执行阶段均可取消
   */
  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.aborted || signal?.aborted) {
      throw new Error(signal?.reason ?? "ConcurrencyLimiter aborted");
    }

    if (this.active >= this.max) {
      const localSignal = signal;
      await new Promise<void>((resolve, reject) => {
        if (localSignal?.aborted) {
          reject(new Error(localSignal.reason?.toString() ?? "Aborted while queued"));
          return;
        }
        const onAbort = () => {
          const idx = this.queue.findIndex(e => e.resolve === resolve);
          if (idx >= 0) this.queue.splice(idx, 1);
          reject(new Error(localSignal!.reason?.toString() ?? "Aborted while queued"));
        };
        localSignal?.addEventListener("abort", onAbort, { once: true });
        this.queue.push({
          resolve: () => { localSignal?.removeEventListener("abort", onAbort); resolve(); },
          reject: (err: Error) => { localSignal?.removeEventListener("abort", onAbort); reject(err); },
        });
      });
    }

    if (signal?.aborted) throw new Error(signal.reason?.toString() ?? "Aborted before execution");

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0 && !this.aborted) {
        const next = this.queue.shift()!;
        next.resolve();
      }
    }
  }

  /**
   * 批量并发执行多个异步函数，共享同一限制器
   * @param fns - 待执行的异步函数数组
   * @param signal - 可选的中止信号
   */
  async runAll<T>(fns: Array<() => Promise<T>>, signal?: AbortSignal): Promise<T[]> {
    return Promise.all(fns.map(fn => this.run(fn, signal)));
  }
}
