import type { ValueRef } from "../ir/types.js";
import type { DslValue } from "./types.js";

const CONTEXT_RE = /^\$context(?:\.(.+))?$/;
const RUN_INPUT_RE = /^\$run\.input(?:\.(.+))?$/;
const NODE_OUTPUT_RE = /^\$node\.output\.([^.]+)(?:\.(.+))?$/;
const FRAME_LOCAL_RE = /^\$frame\.local(?:\.(.+))?$/;
const LITERAL_PREFIX = "literal:";

/**
 * 判断字符串是否为路径表达式（以 $ 或 literal: 开头）。
 *
 * @param value 待检查字符串
 * @returns 是否为路径表达式
 */
export function isPathExpression(value: string): boolean {
  return value.startsWith("$") || value.startsWith("literal:");
}

/**
 * 将路径表达式字符串解析为结构化的 ValueRef 对象。
 * 支持 $context、$run.input、$node.output、$frame.local、literal: 前缀。
 *
 * @param expr 路径表达式字符串
 * @returns 解析后的值引用；无法匹配时回退为字面量
 */
export function parsePathExpression(expr: string): ValueRef {
  const contextMatch = expr.match(CONTEXT_RE);
  if (contextMatch) {
    return { from: "context", path: contextMatch[1] || undefined };
  }

  const runInputMatch = expr.match(RUN_INPUT_RE);
  if (runInputMatch) {
    return { from: "run.input", path: runInputMatch[1] || undefined };
  }

  const nodeOutputMatch = expr.match(NODE_OUTPUT_RE);
  if (nodeOutputMatch) {
    return { from: "node.output", nodeId: nodeOutputMatch[1], path: nodeOutputMatch[2] || undefined };
  }

  const frameLocalMatch = expr.match(FRAME_LOCAL_RE);
  if (frameLocalMatch) {
    return { from: "frame.local", path: frameLocalMatch[1] || undefined };
  }

  if (expr.startsWith(LITERAL_PREFIX)) {
    const raw = expr.slice(LITERAL_PREFIX.length);
    try {
      return { from: "literal", value: JSON.parse(raw) };
    } catch {
      return { from: "literal", value: raw };
    }
  }

  return { from: "literal", value: expr };
}

/**
 * 将 DSL 值统一标准化为 ValueRef。
 * 字符串将按路径表达式解析，已是 ValueRef 的直接返回。
 *
 * @param val DSL 值（字符串或 ValueRef）
 * @returns 标准化后的值引用
 */
export function normalizeDslValue(val: DslValue): ValueRef {
  if (typeof val === "string") {
    if (isPathExpression(val)) {
      return parsePathExpression(val);
    }
    return { from: "literal", value: val };
  }
  return val;
}

/**
 * 标准化控制配置对象中的 condition/loopOver 值为 ValueRef。
 * 其他字段保持原样。
 *
 * @param control 原始控制配置（可为 undefined）
 * @returns 标准化后的控制配置，或 undefined
 */
export function normalizeDslControl(
  control: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (!control) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(control)) {
    if (key === "condition" || key === "loopOver") {
      if (val !== undefined) {
        result[key] = normalizeDslValue(val as DslValue);
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}
