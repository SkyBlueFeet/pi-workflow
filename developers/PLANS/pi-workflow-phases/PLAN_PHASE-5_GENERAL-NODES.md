---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-28 15:30 +08:00
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

## 8. 计划补充（Extractor 节点）

### 8.1 补充目标

在既有通用节点基础上新增 `extractor` 节点，聚焦多源内容抽取与汇总能力，第一阶段不引入节点级特殊重试规则。

目标能力：

1. 支持 `extractor` 节点的基础执行链路（DSL -> IR -> Runtime Executor）。
2. 支持输入源类型：`text` / `html` / `code` / `json`。
3. 支持处理模式：`extract`（字段抽取）/ `summarize`（内容汇总）/ `typed-object`（对象类型约束输出）。
4. 统一结构化输出，保证下游节点可稳定消费 JSON 结果。
5. 保持与现有通用重试机制兼容，但本补充阶段不新增“按错误类型重试”的策略。

### 8.2 配置与类型扩展建议

1. 在 `WorkflowNodeKind` 中新增 `extractor`。
2. 在节点 `executor.config` 中增加以下可选字段：
   - `sourceType`: `"text" | "html" | "code" | "json"`
   - `mode`: `"extract" | "summarize" | "typed-object"`
   - `fields?`: `string[]`
   - `schema?`: `Record<string, unknown>`
   - `summaryStyle?`: `"brief" | "detailed" | "bullet"`
   - `language?`: `string`（默认 `zh-CN`）
   - `maxInputChars?`: `number`

### 8.3 执行器实现策略（MVP）

1. 新增 `src/executors/extractor-executor.ts` 并在执行器注册表装配。
2. `text`：直接基于输入文本执行字段抽取或汇总。
3. `html`：执行轻量清洗（移除 `script/style`，保留标题与正文）后再抽取。
4. `code`：抽取模块职责、公开接口、关键函数与潜在风险信息。
5. `json`：支持按 `fields` 提取与按 `schema` 规整输出。

### 8.4 输出契约（建议）

统一返回：

```ts
{
  data: unknown;
  summary?: string;
  meta: {
    sourceType: "text" | "html" | "code" | "json";
    mode: "extract" | "summarize" | "typed-object";
    confidence?: number;
    warnings?: string[];
  };
}
```

说明：

1. `data` 为主结果，必须可 JSON 序列化。
2. `summary` 仅在 `summarize` 或混合输出场景返回。
3. `meta` 用于可观测性与下游诊断。

### 8.5 测试补充

1. `test/executors/extractor-executor.test.ts` 覆盖四类 `sourceType` 与三类 `mode`。
2. 增加 `http -> extractor(html summarize) -> return` 集成用例。
3. 增加 `manual(code text) -> extractor(typed-object) -> return` 集成用例。
4. 验证空输入、超长输入、字段缺失、schema 不匹配等边界行为。

### 8.6 验收口径

1. `extractor` 可从 DSL 成功编译到 IR 并被 runtime 调度。
2. 四类输入源在默认配置下均可产出结构化 JSON。
3. 三类处理模式在样例中均有可复现通过用例。
4. 不影响现有 `tool/http/if/parallel/loop` 节点与测试结果。
5. 明确记录“特殊节点重试策略暂缓”，避免与本阶段目标耦合。

### 8.7 实现细节补充（可直接开发）

#### 8.7.1 文件改动清单

1. `src/ir/types.ts`
   - 在 `WorkflowNodeKind` 增加 `extractor`。
   - 增加 `ExtractorSourceType`、`ExtractorMode`、`ExtractorConfig` 类型定义。
2. `src/executors/extractor-executor.ts`（新建）
   - 实现 `WorkflowNodeExecutor` 接口。
   - 统一输出 `NodeExecutionResult`，并按本节约定填充 `output`。
3. `src/executors/index.ts`
   - 导出 `ExtractorExecutor`。
4. `src/runtime/workflow-runtime.ts`
   - 在 executor 注册流程中注册 `extractor`。
5. `test/executors/extractor-executor.test.ts`（新建）
   - 覆盖 sourceType/mode 主路径与边界。
6. `test/runtime/*`（新增集成用例文件）
   - 覆盖 `http -> extractor -> return` 与 `manual -> extractor -> return`。

#### 8.7.2 配置契约（建议定稿）

```ts
export type ExtractorSourceType = "text" | "html" | "code" | "json";
export type ExtractorMode = "extract" | "summarize" | "typed-object";

export interface ExtractorConfig {
  readonly sourceType?: ExtractorSourceType;
  readonly mode?: ExtractorMode;
  readonly sourcePath?: string;
  readonly fields?: readonly string[];
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly summaryStyle?: "brief" | "detailed" | "bullet";
  readonly language?: string;
  readonly maxInputChars?: number;
}
```

约束规则：

1. `sourceType` 默认 `text`。
2. `mode` 默认 `extract`。
3. `mode=extract` 时建议提供 `fields`；未提供时允许执行但返回 warning。
4. `mode=typed-object` 时建议提供 `schema`；未提供时返回 `invalid_input`。
5. `maxInputChars` 默认 20000，超出时截断并在 `meta.warnings` 标注。

#### 8.7.3 输入解析与归一化流程

1. 从 `context.nodeInput` 读取源数据：
   - 若配置 `sourcePath`，按路径取值；
   - 否则按优先级读取 `input` -> `content` -> `text`。
2. 输入为空时返回错误：`invalid_input`。
3. 对字符串输入执行长度保护（`maxInputChars`）。
4. 根据 `sourceType` 执行预处理并输出 `normalizedSource`：
   - `text`：原文透传。
   - `html`：移除 `script/style/noscript`，提取 `title`、标题层级与正文文本。
   - `code`：保留原文，补充 `languageHint`、`lineCount`、`symbolHints`（函数/类/导出项的轻量匹配）。
   - `json`：若为字符串先 parse；若为对象直接使用；失败返回 `parse_failed`。

#### 8.7.4 三类 mode 的执行逻辑

1. `extract`
   - 有 `fields`：按字段名提取，支持简单路径（如 `user.name`）。
   - 无 `fields`：返回 key-value 粗抽取结果，并写入 warning。
2. `summarize`
   - 根据 `summaryStyle` 生成摘要文本。
   - `data` 至少包含 `keyPoints: string[]`、`entities?: string[]`、`topics?: string[]`。
3. `typed-object`
   - 先执行结构映射，再按 `schema` 校验必填字段与基础类型。
   - 校验失败返回 `schema_mismatch`，错误中包含字段级原因。

#### 8.7.5 输出与错误模型

成功输出：

```ts
{
  data: unknown;
  summary?: string;
  meta: {
    sourceType: "text" | "html" | "code" | "json";
    mode: "extract" | "summarize" | "typed-object";
    confidence?: number;
    warnings?: string[];
  };
}
```

失败输出（executor error object）：

```ts
{
  errorCode: "invalid_input" | "parse_failed" | "schema_mismatch" | "unsupported_source_type" | "model_refused";
  message: string;
  details?: Record<string, unknown>;
}
```

说明：第一阶段可先在节点 `output.error` 返回上述错误对象，不引入新的 runtime 事件类型。

#### 8.7.6 执行与兼容策略

1. `extractor` 作为原子节点执行，不加入 `CompositeKinds`。
2. 节点级 `timeout` 与通用 `retry` 机制保持原有行为，不新增 extractor 特判。
3. 若调用模型能力，应复用现有 host 能力接口，避免在 runtime 新增专用通道。
4. 未配置 `extractor` 的现有工作流不受影响。

#### 8.7.7 测试细化

单测（`extractor-executor.test.ts`）至少包含：

1. `text + extract(fields)`：字段提取成功。
2. `html + summarize`：清洗后摘要成功。
3. `code + typed-object`：输出包含模块职责与关键符号。
4. `json + extract(fields)`：路径字段提取成功。
5. `json(string) parse failed`：返回 `parse_failed`。
6. `typed-object` 缺少 `schema`：返回 `invalid_input`。
7. 超长输入：触发截断并包含 warning。

集成测试至少包含：

1. `http -> extractor(html summarize) -> return`。
2. `manual(code text) -> extractor(typed-object) -> return`。
3. 与现有节点混用时，`tool/http/if/parallel/loop` 既有用例全部通过。
