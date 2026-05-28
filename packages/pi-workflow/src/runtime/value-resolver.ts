import type { ValueRef } from "../ir/types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

/** 值解析器，根据 ValueRef 从不同来源（运行输入、上下文、节点输出等）解析出实际值 */
export class ValueResolver {
  /**
   * 根据引用定义从对应的数据源中解析出值
   * @param ref - 值引用定义
   * @param runInput - 运行输入数据
   * @param sharedContext - 共享上下文
   * @param nodeResults - 各节点执行结果映射
   * @param frameLocal - 帧本地数据
   * @throws 当 ref.from 为 "node.output" 但对应节点未执行时
   */
  resolve(
    ref: ValueRef,
    runInput: Readonly<Record<string, unknown>>,
    sharedContext: Readonly<Record<string, unknown>>,
    nodeResults: ReadonlyMap<string, NodeExecutionResult>,
    frameLocal: Readonly<Record<string, unknown>>,
  ): unknown {
    switch (ref.from) {
      case "run.input":
        return ref.path ? this.resolvePath(runInput, ref.path) : runInput;
      case "context":
        return ref.path ? this.resolvePath(sharedContext, ref.path) : sharedContext;
      case "node.output": {
        const result = nodeResults.get(ref.nodeId);
        if (!result) {
          throw new Error(`ValueRef 引用的节点 ${ref.nodeId} 尚未执行`);
        }
        return ref.path ? this.resolvePath(result.output as Record<string, unknown>, ref.path) : result.output;
      }
      case "frame.local":
        return ref.path ? this.resolvePath(frameLocal, ref.path) : frameLocal;
      case "literal":
        return ref.value;
    }
  }

  /**
   * 批量解析绑定映射，将每个 key 对应的 ValueRef 解析为实际值
   * @param bindings - 键到值引用的映射
   * @param runInput - 运行输入数据
   * @param sharedContext - 共享上下文
   * @param nodeResults - 各节点执行结果映射
   * @param frameLocal - 帧本地数据
   */
  resolveBindings(
    bindings: Readonly<Record<string, ValueRef>>,
    runInput: Readonly<Record<string, unknown>>,
    sharedContext: Readonly<Record<string, unknown>>,
    nodeResults: ReadonlyMap<string, NodeExecutionResult>,
    frameLocal: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, ref] of Object.entries(bindings)) {
      result[key] = this.resolve(ref, runInput, sharedContext, nodeResults, frameLocal);
    }
    return result;
  }

  private resolvePath(data: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = data;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }
}
