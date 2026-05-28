/** 操作超时时抛出的错误类型 */
export class TimeoutError extends Error {
  /**
   * @param timeoutMs - 超时毫秒数
   */
  constructor(public readonly timeoutMs: number) {
    super(`操作超时 (${timeoutMs}ms)`);
    this.name = "TimeoutError";
  }
}

/**
 * 为 Promise 添加超时控制
 * @param promise - 待包装的 Promise
 * @param timeoutMs - 超时毫秒数
 * @param signal - 可选的中止信号
 * @returns Promise 的返回值
 * @throws TimeoutError 超时时抛出
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new TimeoutError(timeoutMs);

  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
  };

  const abortHandler = (signal && !signal.aborted)
    ? () => { cleanup(); }
    : undefined;

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    if (abortHandler) {
      signal!.addEventListener("abort", () => {
        abortHandler();
        reject(new TimeoutError(timeoutMs));
      }, { once: true });
    }

    promise.then(
      (val) => { cleanup(); resolve(val); },
      (err) => { cleanup(); reject(err); },
    );
  });
}

/**
 * 为异步生成器添加超时控制（流式）
 * @param gen - 异步生成器
 * @param timeoutMs - 超时毫秒数
 * @param signal - 可选的中止信号
 * @yields 生成器的每个数据项
 * @returns 生成器的最终返回值
 * @throws TimeoutError 超时时抛出
 */
export async function* withTimeoutStreaming<TYield, TReturn>(
  gen: AsyncGenerator<TYield, TReturn>,
  timeoutMs: number,
  signal?: AbortSignal,
): AsyncGenerator<TYield, TReturn> {
  if (signal?.aborted) throw new TimeoutError(timeoutMs);

  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; }, timeoutMs);

  const onAbort = () => { timedOut = true; clearTimeout(timer); };
  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      if (timedOut) throw new TimeoutError(timeoutMs);
      const next = await gen.next();
      if (next.done) return next.value;
      yield next.value;
    }
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
