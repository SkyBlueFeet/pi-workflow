---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 18:40 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 8：调试与可视化

## 1. 最终实现目标

阶段 8 完成后，workflow run 应具备可追踪、可回放、可检查的调试能力。

目标能力：

1. 生成完整 run trace。
2. replay runtime events。
3. 查看节点输入、输出、artifact。
4. 查看 checkpoint。
5. 查看 shared context diff。
6. 生成 workflow graph view model。
7. 提供 CLI/SDK 调试入口。
8. 复用阶段 2 event recorder 的原始事件日志，并允许向 runtime event 增加向后兼容的可选调试字段。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. trace 持久化格式。
2. trace 是否与 run state 分离存储。
3. event replay 精度：
   - 只恢复状态。
   - 恢复 context diff。
   - 恢复 artifact timeline。
4. CLI 输出格式：
   - JSON。
   - table。
   - interactive TUI。
5. graph view model 是否服务后续 Web/UI。
6. context diff 算法和大对象截断策略。
7. 阶段 2 event recorder 到阶段 8 trace model 的转换边界。

## 3. 当前已进行工作

已完成：

1. 架构文档已定义 runtime event 模型。
2. 总览计划已定义 trace viewer、context diff、checkpoint browser、graph viewer。
3. 阶段 2 已规划 event recorder，并要求保留可生成 trace 的原始 runtime event。
4. 阶段 3 已规划 store/checkpoint。
5. ✅ `events/trace.ts` 已实现 `WorkflowRunTrace`、`WorkflowTraceFrame`、`WorkflowTraceNode` 与 `buildTrace()`。
6. ✅ `debug/trace-model.ts` 已实现 trace 聚合统计。
7. ✅ `debug/replay.ts` 已实现 runtime event replay。
8. ✅ `debug/context-diff.ts` 已实现 shared context diff。
9. ✅ `debug/graph-model.ts` 已实现 workflow graph view model。
10. ✅ runtime event 已补充 `timestamp`，`node.completed` 已补充 resolved input、runtime output、context snapshot 和 artifacts。
11. ✅ CLI `trace` 已实现，并支持 `--out trace.json` 持久化 trace。
12. ✅ CLI `inspect` 已实现 `--node`、`--context`、`--graph`、`--checkpoints`、`--checkpoint <run-id>`。
13. ✅ CLI `run` 默认挂载 `FileWorkflowRunStore`，paused run 可落盘 checkpoint。

待后续增强：

1. Web/TUI viewer。
2. trace 与 run state 的长期存储策略。
3. 更细粒度 artifact timeline 与跨 checkpoint replay。

## 4. 目录设计

```text
src/events/
  recorder.ts
  trace.ts
src/debug/
  trace-model.ts
  replay.ts
  context-diff.ts
  graph-model.ts
apps/pi-workflow-cli/src/commands/
  trace.ts
  inspect.ts
test/debug/
  trace-model.test.ts
  replay.test.ts
  context-diff.test.ts
```

## 5. 结构设计

Trace model：

```ts
export interface WorkflowRunTrace {
  workflowRunId: string;
  workflowId: string;
  startedAt: string;
  completedAt?: string;
  status: WorkflowRunStatus;
  events: WorkflowRuntimeEvent[];
  frames: WorkflowTraceFrame[];
  nodes: WorkflowTraceNode[];
  artifacts: WorkflowArtifact[];
}
```

Runtime event 调试扩展：

```ts
export type WorkflowRuntimeEvent = {
  timestamp?: string;
} & RuntimeEventPayload;

export interface NodeCompletedEvent {
  type: "node.completed";
  workflowRunId: string;
  nodeId: string;
  input?: Readonly<Record<string, unknown>>;
  output?: unknown;
  contextSnapshot?: Readonly<Record<string, unknown>>;
  artifacts?: readonly WorkflowArtifact[];
}
```

这些字段是向后兼容的可选字段，用于阶段 8 的节点详情、context diff 和 trace 精度。

Graph view model：

```ts
export interface WorkflowGraphViewModel {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  selectedNodeId?: string;
}
```

## 6. 实现路径

1. ✅ 实现 trace model。
2. ✅ 从阶段 2 event recorder 生成 trace。
3. ✅ 实现 trace replay。
4. ✅ 实现 context diff。
5. ✅ 实现 graph view model。
6. ✅ 实现 CLI `trace`。
7. ✅ 实现 CLI `inspect`。
8. ✅ 编写 trace/replay/context/graph 测试。
9. ✅ 补齐 checkpoint browser 与节点 runtime detail。

## 7. 测试与验收

验收标准：

1. ✅ 单次 run 可基于阶段 2 event recorder 生成完整 trace。
2. ✅ trace replay 可恢复节点状态。
3. ✅ context diff 可指出 changed paths。
4. ✅ graph model 可标记 running/paused/completed/failed。
5. ✅ CLI 可查看 run trace、node detail、artifact 和 checkpoint。
6. ✅ trace 可通过 CLI `--out` 写入 JSON 文件。
7. ⏳ Web/TUI viewer 不作为当前阶段验收项。
