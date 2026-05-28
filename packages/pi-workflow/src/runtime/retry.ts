import { AwaitInputError } from "./errors.js";

/** 重试策略配置 */
export interface RetryPolicy {
  /** 最大重试次数 */
  readonly maxAttempts: number;
  /** 重试延迟毫秒数（默认 1000） */
  readonly delayMs?: number;
  /** 退避策略：固定延迟或指数退避 */
  readonly backoff?: "fixed" | "exponential";
}

/** 重试可用的取消信号类型，兼容 AbortSignal 和自定义取消令牌 */
export type RetrySignal = AbortSignal | { readonly cancelled: boolean } | undefined;

function isAborted(signal: RetrySignal): boolean {
  if (!signal) return false;
  if (signal instanceof AbortSignal) return signal.aborted;
  return signal.cancelled;
}

/**
 * 带重试机制的异步函数执行器
 * @param fn - 待执行的异步函数
 * @param policy - 重试策略
 * @param signal - 可选的取消信号
 * @returns 函数执行结果
 * @throws AwaitInputError 时会直接抛出而不重试；其他错误按策略重试后仍失败则抛出最后一次错误
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  signal?: RetrySignal,
): Promise<T> {
  const maxAttempts = Math.max(1, policy.maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (isAborted(signal)) throw new Error("操作已被取消");
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AwaitInputError) throw err;
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, policy);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 带重试机制的异步生成器执行器（流式），重试时重新调用生成器从头生成
 * @param fn - 待执行的异步生成器函数
 * @param policy - 重试策略
 * @param signal - 可选的取消信号
 * @yields 生成的每个数据项
 * @returns 生成器的最终返回值
 * @throws AwaitInputError 直接抛出；其他错误按策略重试
 */
export async function* withRetryStreaming<TYield, TReturn>(
  fn: () => AsyncGenerator<TYield, TReturn>,
  policy: RetryPolicy,
  signal?: RetrySignal,
): AsyncGenerator<TYield, TReturn> {
  const maxAttempts = Math.max(1, policy.maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (isAborted(signal)) throw new Error("操作已被取消");
    try {
      return yield* fn();
    } catch (err) {
      if (err instanceof AwaitInputError) throw err;
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, policy);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const base = policy.delayMs ?? 1000;
  if (policy.backoff === "exponential") {
    return base * Math.pow(2, attempt - 1);
  }
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
