/** 可取消令牌，用于在工作流运行时传播取消信号 */
export class CancellationToken {
  private _cancelled = false;
  private callbacks: Array<() => void> = [];

  /** 是否已被取消 */
  get isCancelled(): boolean {
    return this._cancelled;
  }

  /** 触发取消，执行所有已注册的回调并清空回调列表 */
  cancel(): void {
    this._cancelled = true;
    for (const cb of this.callbacks) cb();
    this.callbacks = [];
  }

  /** 注册取消回调；若已取消则立即执行 */
  onCancelled(callback: () => void): void {
    if (this._cancelled) {
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }

  /** 已取消时抛出 CancelledError */
  throwIfCancelled(): void {
    if (this._cancelled) {
      throw new CancelledError();
    }
  }
}

/** 操作被取消时抛出的错误类型 */
export class CancelledError extends Error {
  constructor(message = "操作已被取消") {
    super(message);
    this.name = "CancelledError";
  }
}
