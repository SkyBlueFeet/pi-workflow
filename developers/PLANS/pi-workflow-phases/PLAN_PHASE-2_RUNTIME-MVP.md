---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 10:00 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 2：确定性 Runtime MVP

## 1. 最终实现目标

阶段 2 完成后，系统应具备不依赖 PI Agent 的确定性 workflow 执行闭环。

目标能力：

1. 加载 IR 并生成执行计划。
2. 创建 root frame 与 child frame。
3. 调度 `manual`、`workflow`、`return` 节点。
4. 解析 ValueRef。
5. 合并 artifact 到 shared context。
6. 输出稳定 runtime event。
7. 定义最小 `WorkflowHostCapabilities` 与 `NullWorkflowHost`。
8. 记录可生成 trace 的原始 runtime event。
9. 提供 deterministic CLI `run`。
10. 执行 fixture 并断言 final output、context、artifact 和 event 顺序。
11. 为 `agent`、`tool` 和外部资源类节点提供 structured unsupported diagnostic，避免后续阶段能力阻塞 runtime MVP。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. `manual` 节点第一版能力边界：
   - 内置 deterministic operation。
   - 注册本地函数。
   - 受限脚本执行。
2. `workflow` 子流程引用方式：
   - 只用 `children`。
   - 支持外部 workflow 文件。
3. artifact merge 策略集合：
   - `replace`。
   - `merge-object`。
   - `append-array`。
4. event 顺序是否作为强约束进入 golden fixture。
5. frame id 与 node result key 规则。
6. planner 对循环依赖的诊断格式。
7. composite node 创建 child frame 的责任边界。
8. 最小 host contract 范围：
   - `emitEvent`。
   - 阶段 2 不定义 `requestUserInput` 与 interaction protocol；暂停、交互输入和恢复语义进入阶段 3。
   - 阶段 2 不把 `runAgent/callTool/listResources` 放入 host contract；相关能力进入阶段 4/5。
9. unsupported executor 的诊断格式：
   - `agent` 在阶段 4 前返回 unsupported diagnostic。
   - `tool/http/if/parallel/loop` 在阶段 5 前返回 unsupported diagnostic。
10. deterministic CLI `run` 的输入输出格式。

## 3. 当前已进行工作

已完成：

1. 架构文档已定义 ExecutionFrame、Shared Context、Artifact、Event 模型。
2. 总览计划已明确 Runtime MVP 支持 `manual/workflow/return`。
3. 总览计划已明确 deterministic runtime 不需要 LLM API key。
4. 总览计划已明确阶段 2 需要固化最小 host contract、event recorder 和 deterministic CLI `run`。

已完成（代码已落地）：

1. ✅ WorkflowRuntime：`src/runtime/workflow-runtime.ts`（含 run / resume / executeFrame / executeCompositeNode / executePrimitiveNode）
2. ✅ Planner：`src/runtime/planner.ts`（getFrameNodeIds / getReadyNodes）
3. ✅ ExecutorRegistry：`src/runtime/executor-registry.ts`
4. ✅ ValueResolver：`src/runtime/value-resolver.ts`
5. ✅ ManualExecutor：`src/executors/manual-executor.ts`
6. ✅ ReturnExecutor：`src/executors/return-executor.ts`
7. ✅ UnsupportedExecutor：`src/executors/unsupported-executor.ts`
8. ✅ ArtifactManager：`src/artifacts/artifact-manager.ts`
9. ✅ EventEmitter + EventRecorder：`src/events/`
10. ✅ WorkflowHostCapabilities + NullWorkflowHost：`src/host/`
11. ✅ CLI run command：`apps/pi-workflow-cli/src/commands/run.ts`
12. ✅ Runtime 测试通过（minimal / subworkflow / unsupported）

## 4. 目录设计

新增或完善：

```text
src/runtime/
  workflow-runtime.ts
  planner.ts
  scheduler.ts
  frame-manager.ts
  executor-registry.ts
  value-resolver.ts
  run-state.ts
  errors.ts
src/executors/
  types.ts
  unsupported-executor.ts
  manual-executor.ts
  workflow-executor.ts
  return-executor.ts
src/artifacts/
  types.ts
  artifact-manager.ts
  merge.ts
src/events/
  types.ts
  emitter.ts
  recorder.ts
src/host/
  types.ts
  null-host.ts
apps/pi-workflow-cli/src/commands/
  run.ts
test/runtime/
  planner.test.ts
  value-resolver.test.ts
  runtime-minimal.test.ts
  runtime-subworkflow.test.ts
  runtime-unsupported.test.ts
```

## 5. 结构设计

Runtime 入口：

```ts
export class WorkflowRuntime {
  constructor(options: WorkflowRuntimeOptions);
  run(request: WorkflowRunRequest): AsyncGenerator<WorkflowRuntimeEvent, WorkflowRunResult, unknown>;
}
```

ExecutionFrame：

```ts
export interface ExecutionFrame {
  frameId: string;
  runId: string;
  parentFrameId?: string;
  frameType: "root" | "subworkflow" | "parallel-branch" | "loop-body";
  workflowId: string;
  nodeId?: string;
  input: Record<string, unknown>;
  localState?: Record<string, unknown>;
  status: "running" | "paused" | "completed" | "failed";
}
```

最小 host contract：

```ts
export interface WorkflowHostCapabilities {
  emitEvent?(event: WorkflowRuntimeEvent): void | Promise<void>;
}
```

阶段 2 的 host contract 只承载事件输出，不承载交互、Agent、Tool 或资源能力。`NullWorkflowHost` 是无宿主能力的默认实现。

阶段 2 的 `unsupported-executor` 对 `agent`、`tool` 和外部资源类节点返回 structured unsupported diagnostic，避免 runtime MVP 被 PI adapter 或通用节点能力阻塞。

`WorkflowInteraction`、`WorkflowInteractionRequest`、`WorkflowInteractionResult` 与 `requestUserInput` 在阶段 3 定义。

## 6. 实现路径

1. 实现 planner。
2. 实现 value resolver。
3. 实现 frame manager。
4. 实现 executor registry。
5. 实现 unsupported executor，并在 registry 中为尚未接入的节点类型提供 fallback。
6. 实现 scheduler。
7. 实现 manual executor。
8. 实现 workflow executor。
9. 实现 return executor。
10. 实现 artifact manager。
11. 实现 event emitter/recorder。
12. 实现最小 host contract 与 `NullWorkflowHost`。
13. 实现 deterministic CLI `run`。
14. 编写 runtime E2E tests。

## 7. 测试与验收

验收标准：

1. root workflow 能完成执行并返回 final output。
2. subworkflow 能创建 child frame 并返回父节点 artifact。
3. manual 节点输出能写入 shared context。
4. event 顺序可稳定断言。
5. 用户输入错误走 diagnostics 或 structured error。
6. `agent` 节点在阶段 4 前返回 unsupported diagnostic。
7. deterministic CLI `run` 可执行不含 PI 能力的 fixture。
