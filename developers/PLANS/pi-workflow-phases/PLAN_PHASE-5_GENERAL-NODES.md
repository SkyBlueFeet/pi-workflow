---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 10:00 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 5：通用节点扩展

## 1. 最终实现目标

阶段 5 完成后，runtime 应具备通用任务编排能力。

目标能力：

1. 支持 `tool` 节点。
2. 支持 `http` 节点。
3. 支持 `if` 条件分支。
4. 支持 `parallel` 并行分支。
5. 支持 `loop` 循环。
6. 支持 timeout、retry、cancel、concurrency policy。
7. 支持并行与循环 frame。
8. 支持 `tool` 节点调用阶段 4 capability catalog 中的第三方 package tool。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. `http` 节点是否作为内置节点实现，还是通过 PI package tool 实现。
2. `tool` 节点调用来源：
   - PI package tool。
   - 本项目注册 tool。
   - 二者都支持。
3. `if` condition 表达式：
   - 简单 ValueRef truthy。
   - 操作符 DSL。
   - JSONLogic。
4. `parallel` 失败策略：
   - 任一失败即取消。
   - 收集全部结果后统一失败。
   - 按 branch policy 控制。
5. `loop` 迭代策略：
   - 串行。
   - 并行。
   - 可配置并发。
6. retry policy 的结构。
7. timeout policy 的作用边界。
8. cancellation signal 是否传递给 PI tool/agent。
9. 第三方 package tool 的调用错误、权限不足和 capability 缺失诊断格式。

## 3. 当前已进行工作

已完成：

1. 架构文档已将 `tool/http/if/parallel/loop` 定义为第二阶段扩展节点。
2. 总览计划已定义 frame 类型包含 `parallel-branch`、`loop-body`。
3. 总览计划已明确阶段 5 是通用节点扩展阶段。
4. 阶段 4 已规划 PI capability catalog 与 `pi-tool-runner`，阶段 5 负责把它们装配为正式 `tool` 节点执行能力。

已完成（代码已落地）：

1. ✅ execution policy 模块：
   - `src/runtime/cancellation.ts`（CancellationToken + CancelledError）
   - `src/runtime/timeout.ts`（withTimeout + TimeoutError）
   - `src/runtime/retry.ts`（withRetry + RetryPolicy，支持 backoff）
   - `src/runtime/concurrency.ts`（ConcurrencyLimiter）
2. ✅ ToolExecutor：`src/executors/tool-executor.ts`（本地注册 + PI callTool）
3. ✅ HttpExecutor：`src/executors/http-executor.ts`（内置 fetch）
4. ✅ IfExecutor：`src/executors/if-executor.ts`（条件评估）
5. ✅ ParallelExecutor：`src/executors/parallel-executor.ts`（分支聚合）
6. ✅ LoopExecutor：`src/executors/loop-executor.ts`（数据源迭代）
7. ✅ Runtime composite 扩展：`src/runtime/workflow-runtime.ts`
   - dispatch if/parallel/loop 到独立 composite handler
   - if：条件 false 时跳过子节点
   - parallel：按分支独立 frame 执行，收集全部结果后上报错误
   - loop：串行迭代，每轮创建 loop-body frame
   - signal 通过 AbortSignal 向下传播到 executor 和 PI host
8. ✅ IR 类型扩展：`WorkflowRetryPolicy` + `itemName` 字段
9. ✅ DSL 类型扩展：`itemName` + `backoff` 字段
10. ✅ 5 个 DSL fixture（tool / http / if / parallel / loop）
11. ✅ 20 个新测试通过（policy 模块 + executor + runtime composite）

## 4. 目录设计

```text
src/executors/
  tool-executor.ts
  http-executor.ts
  if-executor.ts
  parallel-executor.ts
  loop-executor.ts
src/runtime/
  cancellation.ts
  concurrency.ts
  retry.ts
  timeout.ts
test/executors/
  tool-executor.test.ts
  http-executor.test.ts
  if-executor.test.ts
  parallel-executor.test.ts
  loop-executor.test.ts
test/fixtures/dsl/
  tool.workflow.json
  http.workflow.json
  if.workflow.json
  parallel.workflow.json
  loop.workflow.json
```

## 5. 结构设计

Execution policy：

```ts
export interface WorkflowExecutionPolicy {
  timeoutMs?: number;
  retry?: WorkflowRetryPolicy;
  concurrency?: number;
  cancelOnFailure?: boolean;
}
```

Loop control：

```ts
export interface WorkflowLoopControlIR {
  source: ValueRef;
  itemName?: string;
  body: string[];
  maxIterations?: number;
  mergeStrategy?: "array" | "last" | "object-by-index";
}
```

## 6. 实现路径

1. 扩展 DSL schema。
2. 扩展 IR node kind 与 control 类型。
3. 定义 execution policy 在 executor、scheduler 和 composite frame 中的作用边界。
4. 实现 cancellation signal 与取消传播接口。
5. 实现 timeout。
6. 实现 retry。
7. 实现 concurrency limiter。
8. 实现 `tool-executor`，支持调用本地注册 tool 和阶段 4 capability catalog 中的第三方 package tool。
9. 实现 `http-executor`。
10. 实现 `if-executor`。
11. 实现 `parallel-executor`。
12. 实现 `loop-executor`。
13. 编写每类节点 fixture 与测试。

## 7. 测试与验收

验收标准：

1. 五类节点均可从 DSL 转 IR 并执行。
2. `tool` 节点可调用第三方 package tool。
3. parallel 分支能独立产生 child frame 并合并结果。
4. loop 能基于 ValueRef 数据源迭代。
5. timeout、retry、cancel 有测试覆盖。
6. 并发上限可稳定验证。
