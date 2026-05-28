import type { ValueRef } from "../ir/types.js";

/**
 * 判断值引用是否为字面量类型。
 *
 * @param ref 值引用对象
 * @returns 是否为字面量引用
 */
export function isLiteralValueRef(ref: ValueRef): ref is { from: "literal"; value: unknown } {
  return ref.from === "literal";
}

/**
 * 判断值引用是否指向某个节点的输出。
 *
 * @param ref 值引用对象
 * @returns 是否为节点输出引用
 */
export function isNodeOutputValueRef(ref: ValueRef): ref is { from: "node.output"; nodeId: string; path?: string } {
  return ref.from === "node.output";
}

/**
 * 判断值引用是否指向运行时的入口输入。
 *
 * @param ref 值引用对象
 * @returns 是否为运行输入引用
 */
export function isRunInputValueRef(ref: ValueRef): ref is { from: "run.input"; path?: string } {
  return ref.from === "run.input";
}

/**
 * 判断值引用是否指向运行时上下文。
 *
 * @param ref 值引用对象
 * @returns 是否为上下文引用
 */
export function isContextValueRef(ref: ValueRef): ref is { from: "context"; path?: string } {
  return ref.from === "context";
}

/**
 * 将值引用对象序列化为可读字符串描述。
 *
 * @param ref 值引用对象
 * @returns 可读字符串（如 "nodeA.output.result"）
 */
export function describeValueRef(ref: ValueRef): string {
  switch (ref.from) {
    case "run.input":
      return `run.input${ref.path ? `.${ref.path}` : ""}`;
    case "context":
      return `context${ref.path ? `.${ref.path}` : ""}`;
    case "node.output":
      return `${ref.nodeId}.output${ref.path ? `.${ref.path}` : ""}`;
    case "frame.local":
      return `frame.local${ref.path ? `.${ref.path}` : ""}`;
    case "literal":
      return `literal(${JSON.stringify(ref.value)})`;
  }
}
