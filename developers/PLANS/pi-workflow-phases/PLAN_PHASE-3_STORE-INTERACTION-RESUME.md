---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 10:00 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 3：Store、Interaction 与 Resume

## 1. 最终实现目标

阶段 3 完成后，workflow run 应支持暂停、保存、读取、恢复和继续执行。

目标能力：

1. 定义完整 `WorkflowRunState`。
2. 定义 `WorkflowInteraction`。
3. 定义 `WorkflowSessionCheckpoint`。
4. 实现 memory store。
5. 实现 file store。
6. 实现 `manual` 节点 await-input。
7. 实现 `resume(workflowRunId, interactionInput)`。
8. 固化节点边界重入语义。
9. 提供 deterministic CLI `resume`。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. file store 默认存储位置。
2. run state 文件命名规则。
3. resume 是否严格采用节点边界重入。
4. workflow definition hash 不匹配时的处理策略：
   - 阻止恢复。
   - 警告后恢复。
   - 允许用户指定策略。
5. interaction input 写入位置：
   - 当前 frame local。
   - 当前 node input。
   - pendingInteraction result。
6. host-neutral `WorkflowSessionCheckpoint` 字段。
7. store 写入是否采用临时文件 + rename。
8. deterministic CLI `resume` 的参数格式、输出格式和错误码。

不作为阶段 3 准入项：

1. PI session checkpoint 的具体写入方式。
2. PI session 字段映射。
3. PI-backed checkpoint 的读取与恢复装配。

以上内容进入阶段 4，由 PI adapter 沿用阶段 3 的 resume contract 装配。

## 3. 当前已进行工作

已完成：

1. 架构文档已定义双层状态模型。
2. 架构文档已定义节点边界重入恢复语义。
3. 总览计划已明确 store 保存完整 run state，host-neutral session checkpoint 保存轻量索引。
4. 总览计划已明确阶段 3 需要提供 deterministic CLI `resume`，PI-backed checkpoint 装配推迟到阶段 4。

已完成（代码已落地）：

1. ✅ Store contract：`src/store/types.ts`（WorkflowRunStore interface）
2. ✅ MemoryStore：`src/store/memory-store.ts`
3. ✅ FileStore：`src/store/file-store.ts`
4. ✅ WorkflowRunState / WorkflowInteraction：`src/store/types.ts`
5. ✅ Resume protocol：`src/runtime/workflow-runtime.ts`（resume 方法）
6. ✅ 暂停保存 + state 序列化：createRunState
7. ✅ CLI resume command：`apps/pi-workflow-cli/src/commands/resume.ts`
8. ✅ pause/resume fixture：`test/fixtures/dsl/pause-resume.workflow.json`
9. ✅ pause/resume 测试通过（pause + resume 两个测试用例）
10. ✅ MemoryStore 测试通过（4 个测试用例）

## 4. 目录设计

新增或完善：

```text
src/store/
  types.ts
  memory-store.ts
  file-store.ts
  checkpoint.ts
src/runtime/
  resume.ts
src/executors/
  manual-executor.ts
apps/pi-workflow-cli/src/commands/
  resume.ts
test/store/
  memory-store.test.ts
  file-store.test.ts
test/runtime/
  pause-resume.test.ts
test/fixtures/dsl/
  pause-resume.workflow.json
```

## 5. 结构设计

Store contract：

```ts
export interface WorkflowRunStore {
  saveRunState(state: WorkflowRunState): Promise<void>;
  loadRunState(workflowRunId: string): Promise<WorkflowRunState | undefined>;
  listRunStates?(query?: WorkflowRunStateQuery): Promise<WorkflowRunStateSummary[]>;
  deleteRunState?(workflowRunId: string): Promise<void>;
}
```

Resume request：

```ts
export interface WorkflowResumeRequest {
  workflowRunId: string;
  interactionId: string;
  input: unknown;
}
```

## 6. 实现路径

1. 定义 run state。
2. 定义 interaction。
3. 定义 host-neutral session checkpoint。
4. 实现 memory store。
5. 实现 file store。
6. 扩展 runtime paused 状态处理。
7. 扩展 manual executor await-input。
8. 实现 resume。
9. 实现 deterministic CLI `resume`。
10. 编写 pause/resume fixture。
11. 编写 store 与 resume 测试。

## 7. 测试与验收

验收标准：

1. 节点等待输入时 run 进入 paused。
2. store 保存完整 frame、nodeResults、sharedContext、pendingInteraction。
3. resume 后从当前 frame 的当前节点继续推进。
4. 已完成前序节点结果保持稳定。
5. interactionId 不匹配时返回错误。
6. deterministic CLI `resume` 可恢复阶段 3 pause/resume fixture。
