# 阶段 10.5 专项计划：Workflow TUI 第一阶段实施与第二阶段规划

> 创建时间：2026-06-10 19:30 +08:00
> 最后更新：2026-06-11 21:20 +08:00
> 当前状态：第一阶段已完成，第二阶段规划中
> 验收状态：第一阶段已验收

---

## 1. 背景与目标

- 背景：
  阶段 10 已完成独立 agent 的 `pi-tui` 主链路、Assembly DSL 收口与 workflow 侧事实源统一，但 workflow 运行入口仍以文本流 CLI 为主，尚未形成正式的 workflow 级 TUI 运行面。当前 [PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md](./PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md) 已明确：既有验收对象是独立 agent 的 `pi-tui`，不把“完整 workflow 运行进入 PI 原生 TUI 外壳”作为既有承诺。
- 目标：
  1. 第一阶段为 workflow 交付正式的观察型 shell 主链路，统一 `run` / `resume` 的运行装配、事件事实源与渲染入口。
  2. 第一阶段将 workflow 对 agent/tool 的关键观察信号从纯字符串日志提升为结构化事件，保证后续界面消费的是正式事实源，而不是日志解析结果。
  3. 第二阶段在第一阶段基础上，规划整合 PI 底层终端框架，交付真正可感知的 workflow TUI 运行面，而不是继续停留在增强日志渲染。
  4. 第二阶段规划通过 workflow shell 统一承载总览、agent 子视图与输入焦点路由，复用 PI 的通用终端能力与 agent session/runtime 能力，但不复用独立 `agent run` 的 TUI 外壳。
  5. workflow TUI 的两阶段实现均以 workflow shell 为唯一终端控制者，不引入嵌套 `InteractiveMode.run()` 的旁路方案。
- 范围：
  1. 第一阶段范围包括：共享 runtime/host/registry/store 装配入口、`run` / `resume` 共用 runner、观察型 workflow shell、结构化事件提升、回归测试与文档同步。
  2. 第二阶段规划范围包括：PI 通用终端框架接入、workflow TUI app、agent 子视图、输入焦点路由、嵌入式 agent session 适配层、双层事件模型与对应测试落地。
  3. 本计划同时覆盖第一阶段既有实现事实，以及第二阶段的重新排期与推荐实施顺序。
- 非目标：
  1. 第一阶段不直接把 `pi-coding-agent` 的 `InteractiveMode.run()` 嵌入 workflow TUI。
  2. 第二阶段不通过复用独立 `agent run` 的成品外壳来实现 workflow TUI。
  3. 第二阶段不让 agent 子链路直接接管终端输入输出。
  4. 第一阶段不展示 skill / MCP 细粒度事件，只展示统一抽象后的 agent/tool 活动。
  5. 两阶段均不改变 DSL / IR 的既有运行语义，也不引入 Web UI。

### 1.1 当前代码现状与实施前提

基于当前代码结构，阶段 10.5 的实施与功能确定基于以下事实：

1. `run` 与 `resume` 当前并未共用同一套装配路径：
   - [apps/pi-workflow-cli/src/commands/run.ts](../../../apps/pi-workflow-cli/src/commands/run.ts)
   - [apps/pi-workflow-cli/src/commands/resume.ts](../../../apps/pi-workflow-cli/src/commands/resume.ts)
2. `run` 当前会注册 `tool`、`http`、`extractor` 等执行器并构造真实宿主；`resume` 当前却将部分执行器降级为 `UnsupportedExecutor`，恢复后能力集不一致。
3. `WorkflowRuntimeEvent` 当前已是 workflow 正式事实源，但对 TUI 而言仍偏向通用日志事件：
   - [packages/pi-workflow/src/events/types.ts](../../../packages/pi-workflow/src/events/types.ts)
4. agent 内部已存在更细粒度宿主事件：
   - [packages/pi-workflow/src/adapters/pi/types.ts](../../../packages/pi-workflow/src/adapters/pi/types.ts)
   - [packages/pi-workflow/src/executors/agent-executor.ts](../../../packages/pi-workflow/src/executors/agent-executor.ts)
   但目前大多被压平成 `node.progress.message` 字符串。
5. `WorkflowRuntime` 与 `RuntimeExecutor` 已提供稳定的 `run` / `resume` / `workflow.paused` / `workflow.resumed` 基线语义：
   - [packages/pi-workflow/src/runtime/workflow-runtime.ts](../../../packages/pi-workflow/src/runtime/workflow-runtime.ts)
   - [packages/pi-workflow/src/runtime/runtime-executor.ts](../../../packages/pi-workflow/src/runtime/runtime-executor.ts)
6. 独立 agent 的 `pi-tui` 已形成可复用事实源；同时 PI 生态已存在可单独使用的底层终端框架，第二阶段应优先复用其通用终端能力，而不是复用独立 agent TUI 外壳。

### 1.2 主体决策

本计划的关键决策固定如下，后续实施与文档口径均以此为准：

1. 第二阶段外层 UI 固定复用 PI 的通用终端框架，不复用独立 `agent run` 的 TUI runner 外壳。
2. 第二阶段内层 agent 会话固定复用 `runtime/session` 能力层，不重新发明 agent 事实源与会话模型。
3. 第一阶段 shell 不单独展示 skill / MCP 细粒度事件，只展示统一抽象后的 agent 文本增量与 tool 活动。
4. workflow shell 在两个阶段中始终是唯一终端控制者。
5. agent 子视图通过嵌入式 session 适配层接入，不直接接管终端输入输出，不嵌套 `InteractiveMode.run()`。

### 1.3 两阶段关系

本计划中的第一阶段与第二阶段是顺序关系，不是互斥关系：

1. 第一阶段先解决统一装配、统一事件、统一渲染入口与观察型 shell 主链路。
2. 第二阶段在第一阶段完成后，先将外层渲染从增强日志升级为基于 PI 通用终端框架的真正 TUI，再基于统一事件总线与 runtime/session 复用层扩展 agent 子视图与输入焦点路由。
3. 第一阶段的技术选型不得锁死第二阶段；第二阶段的实施顺序必须优先解决外层终端框架与输入控制权，再接入 agent 子会话交互。

---

## 2. 交付范围

- [x] 交付第一阶段观察型 workflow shell 主链路
- [x] 交付 `run` / `resume` 共用的 runtime/host/registry/store 装配入口
- [x] 交付 workflow shell 可消费的结构化事件提升方案
- [x] 交付统一 runner / renderer 接口与 text / tui 双渲染能力
- [x] 交付第一阶段测试、文档与验收证据
- [ ] 规划基于 PI 通用终端框架的 workflow TUI 外层运行面
- [ ] 规划第二阶段 agent 子视图、输入焦点路由、runtime/session 复用层与双层事件模型
- [ ] 规划第二阶段测试、文档与验收证据

### 2.1 第一阶段用户可感知结果

第一阶段完成后，用户侧应感知到以下行为：

1. `pi-workflow run ...` 与 `pi-workflow resume ...` 进入同一套 workflow shell，而不是两套独立打印逻辑。
2. shell 稳定展示：
   - 工作流标题
   - 当前运行节点
   - 节点开始 / 完成 / 失败
   - agent 文本增量
   - tool start / end
   - pause / resume
   - complete / fail
3. 暂停后恢复仍沿用阶段 3 的 `workflow.paused` 与 `resume` 协议，用户恢复命令口径不变。
4. 独立 `agent run` 继续走既有 `pi-tui` 主链路，不与 workflow shell 争抢终端控制权。
5. 第一阶段不单独显示 skill / MCP 细粒度事件。

### 2.2 第二阶段目标用户可感知结果

第二阶段完成后，用户侧应感知到以下能力：

1. 用户运行 `pi-workflow run ...` 后进入真正的 workflow TUI，而不是增强日志输出。
2. 用户可以在 workflow 总览中看到稳定布局、状态刷新与聚焦中的主视图，而不是滚动式打印。
3. 用户可以从 workflow 总览进入某个 `agent` 节点的子视图，而不是只能在外层看节点进度流。
4. 用户进入 agent 子视图后，可以直接看到：
   - agent 消息流
   - 工具调用开始 / 结束
   - 关键错误与终态
   - 当前输入缓冲与发送结果
5. 用户可以在 agent 子视图内继续向该 agent 发送输入，而不是只能被动观看本轮输出。
6. 用户可以从 agent 子视图返回 workflow 总览，且总览状态不会丢失。
7. workflow 级 `await_input` / pause-resume 输入与 agent 子会话输入具备清晰分离的焦点，不会发生“同一行输入不知道发给谁”的情况。
8. 同一个 agent，在 workflow 中进入子视图时看到的工具活动、消息流和终态，应与独立 `agent run` 的事实源一致，而不是另一套旁路实现。

### 2.3 不接受的结果

以下结果不计入阶段 10.5 完成：

1. 仅新增一个 TUI 渲染层，但 `run` / `resume` 仍各自手工构造 runtime 与 host。
2. 继续依赖解析 `node.progress.message` 字符串来区分工具开始、工具结束或 agent 文本。
3. 将 workflow TUI 直接写回 `run.ts` / `resume.ts`，未抽共用 runner / renderer。
4. 将所谓 workflow TUI 实现为仅比文本模式多几行提示的增强日志输出。
5. 通过嵌套独立 `agent run` 的 `pi-tui` 终端外壳来实现 workflow TUI 或 agent 子视图。
6. 第一阶段直接扩展 skill / MCP 细粒度事件显示面，导致观察型 shell 范围失控。
7. 第二阶段复用独立 TUI runner 外壳，而不是复用 PI 通用终端框架与 `runtime/session` 能力层。
8. 第二阶段出现多个终端控制者，或多方直接争抢标准输入。
9. 任一阶段通过引入新的 pause/resume 协议、状态文件格式或输入恢复语义来规避现有问题。

---

## 3. 分阶段任务

### Phase 1：统一运行装配工厂

- [x] 盘点并收口 `run.ts` 与 `resume.ts` 现有重复装配逻辑，形成统一职责划分
- [x] 新增 CLI 侧共用工厂，覆盖：
  - [x] `ExecutorRegistry` 创建
  - [x] `WorkflowRuntime` 创建
  - [x] `FileWorkflowRunStore` 注入
  - [x] `MockPiHostAdapter` / `PiHostAdapter` 选择
  - [x] 配置加载、安全策略、扩展扫描、内置工具注册
- [x] 确保 `run` 与 `resume` 在相同配置下获得相同能力集，不能再出现恢复链路将 `tool/http/extractor` 降级为 `UnsupportedExecutor`
- [x] 将装配入口收口到 CLI 层独立目录：
  - [x] `apps/pi-workflow-cli/src/runtime/create-workflow-runtime-context.ts`
  - [x] `apps/pi-workflow-cli/src/runtime/create-workflow-host.ts`
  - [x] `apps/pi-workflow-cli/src/runtime/create-workflow-executor-registry.ts`

### Phase 2：提升 workflow 事件模型并保持兼容

- [x] 以 `WorkflowRuntimeEvent` 作为正式消费事实源，新增或扩展面向 shell 的结构化事件表达
- [x] 保持既有 `workflow.started` / `workflow.resumed` / `workflow.paused` / `workflow.completed` / `workflow.failed` 语义不变
- [x] 保持现有 `node.progress` 对文本链路兼容，不允许直接删掉旧事件
- [x] 将以下宿主信号提升为 shell 直接消费的结构化信息：
  - [x] agent 文本增量
  - [x] agent tool start
  - [x] agent tool end
- [x] 第一阶段不单独暴露 skill / MCP 细粒度显示事件
- [x] 明确映射边界：
  - [x] backend 事件 -> `WorkflowHostEvent`
  - [x] `WorkflowHostEvent` -> `WorkflowRuntimeEvent`
  - [x] shell 只消费 `WorkflowRuntimeEvent`
- [x] 兼容要求：
  - [x] 既有 CLI 文本输出链路不能失效
  - [x] trace / replay / 现有测试夹具不能因字段语义变化整体失效

### Phase 3：抽共用 runner 与观察型 shell

- [x] 将命令层“直接打印事件”的实现改为“调用 runner + renderer”
- [x] 新增 workflow runner，职责包括：
  - [x] 驱动 `runtime.run(...)` / `runtime.resume(...)`
  - [x] 将统一事件流转发给 renderer
  - [x] 处理最终退出码与错误传播
- [x] 新增观察型 workflow shell，职责包括：
  - [x] 维护 view-model，而不是在命令实现中散落状态变量
  - [x] 渲染当前运行节点、节点生命周期、agent 文本增量、tool 活动、pause / resume / final state
  - [x] 支持 `run` 与 `resume` 共用
- [x] 拆分以下文件：
  - [x] `apps/pi-workflow-cli/src/workflow-runner/workflow-runner.ts`
  - [x] `apps/pi-workflow-cli/src/tui/workflow-tui-shell.ts`
  - [x] `apps/pi-workflow-cli/src/tui/workflow-view-model.ts`
  - [x] `apps/pi-workflow-cli/src/tui/workflow-renderer.ts`
- [x] 保留 `text` renderer，保证非 TTY 场景可回退
- [x] 第一阶段 shell 只做总览观察，不做以下能力：
  - [x] agent 子视图切换
  - [x] 节点级交互输入焦点管理
  - [x] 嵌套完整 agent 子会话

### Phase 4：命令接线、回归测试与文档同步

- [x] `run.ts` 改为：
  - [x] 负责输入解析、bundle / IR 加载、配置读取
  - [x] 调用统一 runtime context 工厂
  - [x] 交给 runner + shell 渲染
- [x] `resume.ts` 改为：
  - [x] 负责恢复参数解析、state 加载、输入读取
  - [x] 调用同一 runtime context 工厂
  - [x] 交给同一 runner + shell 渲染
- [x] 回归测试覆盖：
  - [x] `run` 正常完成
  - [x] `pause -> resume`
  - [x] agent 节点文本流
  - [x] tool start / end 事件显示
  - [x] workflow failed
  - [x] `run` / `resume` 装配一致性
- [x] 文档同步覆盖：
  - [x] 本计划状态更新
  - [x] `developers/PLANS/pi-workflow-phases/README.md` 如需文字更新则同步
  - [x] 必要的 CLI 使用说明或开发留痕

### Phase 5：接入 PI 通用终端框架（规划）

- [ ] 抽象 workflow shell 的第二阶段外层运行面为真正的终端应用，而不是 renderer 分支
- [ ] 明确并接入 PI 通用终端框架能力，至少覆盖：
  - [ ] 终端驱动 / 渲染循环
  - [ ] 组件容器 / 布局
  - [ ] 焦点切换
  - [ ] 输入组件
  - [ ] 局部刷新
- [ ] 明确第二阶段复用路线：
  - [ ] 外层复用 PI 通用终端框架
  - [ ] 内层复用 `runtime/session` 底层能力
  - [ ] 不复用独立 TUI runner 外壳
- [ ] 明确第二阶段终端控制边界：
  - [ ] workflow shell 是唯一终端控制者
  - [ ] 不嵌套 `InteractiveMode.run()`
  - [ ] 不允许 agent 子链路直接读取 `stdin`

### Phase 6：实现 workflow 总览 TUI（规划）

- [ ] 新增正式的 workflow TUI app / shell 入口
- [ ] 将现有 `WorkflowViewModel` 接到组件化视图，而不是接到 `console.log` renderer
- [ ] 第一批总览视图至少稳定展示：
  - [ ] 工作流标题 / runId / 状态
  - [ ] 当前节点
  - [ ] 节点状态列表
  - [ ] 最近 agent/tool 活动
  - [ ] 暂停 / 恢复 / 终态
- [ ] 保留 text renderer 作为非 TTY 和测试回退

### Phase 7：接入 agent 子视图与输入焦点路由（规划）

- [ ] 交付 workflow shell 内部正式的 agent 子视图运行面
- [ ] 用户可从 workflow 总览进入 agent 子视图、发送输入并返回总览
- [ ] 确定并实现第二阶段输入焦点路由：
  - [ ] `overview`
  - [ ] `workflow-input`
  - [ ] `agent-session`
- [ ] 确定并实现第二阶段双层事件模型：
  - [ ] workflow 外层继续消费 `WorkflowRuntimeEvent`
  - [ ] agent 子视图内部消费 `EmbeddedAgentSessionEvent`
- [ ] 保证从 agent 子视图返回后 workflow 总览状态不丢失

### Phase 8：测试、文档与验收（规划）

- [ ] 覆盖第二阶段 workflow 总览 TUI 进入与退出
- [ ] 覆盖进入 agent 子视图、发送输入与返回总览
- [ ] 覆盖 workflow `await_input` 与 agent 子会话输入焦点互斥
- [ ] 覆盖独立 `agent run` 主链路未被破坏
- [ ] 同步本计划、阶段索引与必要开发文档

---

## 4. 目录设计

阶段 10.5 按“命令层 / 装配层 / 运行层 / 渲染层 / 子视图接入层”拆分。

- CLI 命令入口：
  - [apps/pi-workflow-cli/src/commands/run.ts](../../../apps/pi-workflow-cli/src/commands/run.ts)
  - [apps/pi-workflow-cli/src/commands/resume.ts](../../../apps/pi-workflow-cli/src/commands/resume.ts)
- 共用装配层：
  - `apps/pi-workflow-cli/src/runtime/create-workflow-runtime-context.ts`
  - `apps/pi-workflow-cli/src/runtime/create-workflow-host.ts`
  - `apps/pi-workflow-cli/src/runtime/create-workflow-executor-registry.ts`
- runner / shell 层：
  - `apps/pi-workflow-cli/src/workflow-runner/workflow-runner.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-tui-shell.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-view-model.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-renderer.ts`
- 第一阶段结构化事件落点：
  - [packages/pi-workflow/src/events/types.ts](../../../packages/pi-workflow/src/events/types.ts)
  - [packages/pi-workflow/src/executors/agent-executor.ts](../../../packages/pi-workflow/src/executors/agent-executor.ts)
  - [packages/pi-workflow/src/adapters/pi/types.ts](../../../packages/pi-workflow/src/adapters/pi/types.ts)
  - [packages/pi-workflow/src/adapters/pi/pi-event-mapper.ts](../../../packages/pi-workflow/src/adapters/pi/pi-event-mapper.ts)
- 第二阶段 PI 通用终端框架接入层：
  - `apps/pi-workflow-cli/src/tui/workflow-tui-app.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-layout.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-focus-manager.ts`
- 第二阶段 runtime/session 复用层：
  - `packages/pi-workflow/src/adapters/pi/pi-agent-session-runtime.ts`
  - `packages/pi-workflow/src/adapters/pi/embedded-agent-session.ts`
- 第二阶段 shell 扩展层：
  - `apps/pi-workflow-cli/src/tui/workflow-input-router.ts`
  - `apps/pi-workflow-cli/src/tui/agent-subview-model.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-tui-shell.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-view-model.ts`

---

## 5. 结构设计

### 5.1 Runtime Context 工厂

第一阶段新增统一的 runtime context 结果对象，供 `run` / `resume` 共用，包含：

1. `runtime`
2. `store`
3. `host`
4. `executorRegistry`
5. `config`
6. `metadata`
   - 是否 mock
   - 是否开启扩展扫描
   - 已注册工具数
   - 当前运行模式

目标是把命令层从“如何装配”中解耦，只保留“拿什么输入去调用”。

### 5.2 Workflow Shell View Model

第一阶段 shell 维护以下稳定 view-model：

1. workflow 基本信息：
   - `workflowId`
   - `workflowRunId`
   - `title`
   - `status`
2. 节点状态：
   - `pending`
   - `running`
   - `completed`
   - `failed`
3. 当前活动节点：
   - 当前 `nodeId`
   - 当前标题
   - 是否为 agent 节点
4. agent 流式内容缓冲：
   - 当前流式节点
   - 已累计文本
5. 最近结构化活动：
   - 最近 tool start / end
   - 最近 pause / resume
   - 最近错误
6. 终态：
   - completed
   - failed
   - paused

### 5.3 第一阶段事件兼容策略

第一阶段事件演进遵守以下策略：

1. 允许新增事件类型或新增结构化字段。
2. 不允许无兼容层地修改既有事件字段语义。
3. 文本 CLI renderer 可以把结构化事件降级渲染成旧式文案。
4. TUI shell 不应再依赖解析字符串判断事件类别。
5. 第一阶段不单独引入 skill / MCP 细粒度显示事件。

### 5.4 第二阶段 PI 通用终端框架复用层

第二阶段外层 UI 不再停留在 `WorkflowTuiRenderer` 这种增强日志渲染，而是升级为基于 PI 通用终端框架的正式终端应用。

复用原则：

1. 复用 PI 底层终端驱动、组件容器、焦点切换与局部刷新能力。
2. 不复用独立 agent `InteractiveMode.run()` 成品外壳。
3. workflow 自己实现顶层 app / shell，并作为唯一终端控制者。
4. text renderer 继续保留，作为非 TTY / 测试回退。

### 5.5 第二阶段 runtime/session 复用层

第二阶段从独立 `pi-tui` 运行链路中抽出可复用的 runtime/session 创建函数：

1. `createPiAgentSessionRuntime(...)`
   - 只负责基于 `ResolvedPiAgentAssembly` 创建 `AgentSessionRuntime`
   - 暴露 session、订阅、prompt、dispose 等底层能力
2. `runResolvedAssemblyInPiTui(...)`
   - 复用 `createPiAgentSessionRuntime(...)`
   - 再创建独立 `InteractiveMode` 并执行 `run()`

这样独立 `agent run` 继续保持不变，workflow 第二阶段只复用 `runtime/session` 能力层，不复用独立 TUI runner 外壳。

### 5.6 第二阶段嵌入式 agent session 适配层

第二阶段通过嵌入式 session 适配层把 agent session 接入 workflow shell。

接口：

```ts
export interface EmbeddedAgentSessionController {
  readonly sessionId: string;
  attach(): Promise<void>;
  detach(): Promise<void>;
  prompt(input: string): Promise<void>;
  dispose(): Promise<void>;
  getSnapshot(): EmbeddedAgentSessionSnapshot;
  onEvent(listener: (event: EmbeddedAgentSessionEvent) => void): () => void;
}
```

事件模型：

```ts
export type EmbeddedAgentSessionEvent =
  | { type: "agent.message.delta"; nodeId: string; delta: string }
  | { type: "agent.tool.start"; nodeId: string; toolName: string }
  | { type: "agent.tool.end"; nodeId: string; toolName: string }
  | { type: "agent.error"; nodeId: string; error: string }
  | { type: "agent.state"; nodeId: string; state: "idle" | "streaming" | "completed" | "failed" };
```

内部实现步骤：

1. 调用 `createPiAgentSessionRuntime(...)`
2. 获取 `runtime.session`
3. 订阅 `runtime.session.subscribe(...)`
4. 将 session 事件映射成 `EmbeddedAgentSessionEvent`
5. `prompt(input)` 内部调用 `runtime.session.prompt(input)`

### 5.7 第二阶段输入焦点路由

焦点模型：

```ts
type WorkflowShellFocus =
  | { type: "overview" }
  | { type: "workflow-input"; interaction: WorkflowInteraction }
  | { type: "agent-session"; nodeId: string };
```

要求：

1. workflow 总览导航输入只在 `overview` 焦点生效。
2. `await_input` 恢复输入只在 `workflow-input` 焦点生效。
3. agent 子会话输入只在 `agent-session` 焦点生效。
4. 任何时刻只能有一个焦点拥有者。
5. workflow shell 是唯一终端控制者，禁止多方直接读取 `process.stdin`。

### 5.8 第二阶段 Agent 子视图 model

确定字段：

```ts
interface AgentSubviewModel {
  nodeId: string;
  title: string;
  sessionState: "idle" | "streaming" | "completed" | "failed";
  transcript: Array<{ role: "user" | "assistant" | "system"; text: string }>;
  toolTimeline: Array<{ toolName: string; status: "start" | "end"; at: string }>;
  diagnostics: string[];
  inputBuffer: string;
}
```

该 model 的事件来源只允许是：

1. workflow 结构化事件
2. `EmbeddedAgentSessionEvent`

### 5.9 第二阶段双层事件模型

第二阶段采用双层事件模型：

1. workflow 外层：
   - 继续使用 `WorkflowRuntimeEvent`
   - 负责节点生命周期、pause / resume、工作流终态等
2. agent 子视图内部：
   - 使用 `EmbeddedAgentSessionEvent`
   - 负责消息流、工具调用、agent 子态、关键错误等

shell 自己负责把两层事件折叠到统一 view-model。

---

## 6. 实施任务清单

本节用于把阶段 10.5 拆成可直接执行的开发任务，按依赖顺序推进。
其中 6.1-6.7 为第一阶段历史实施留档，已完成；6.8 及以后为第二阶段规划入口。

### 6.1 任务 1：抽统一装配工厂

- [x] 在 `apps/pi-workflow-cli/src/runtime/` 下新增共用装配层
- [x] 抽取 `run.ts` / `resume.ts` 中重复的以下逻辑：
  - [x] `ExecutorRegistry` 创建
  - [x] `WorkflowRuntime` 创建
  - [x] `FileWorkflowRunStore` 创建与注入
  - [x] `MockPiHostAdapter` / `PiHostAdapter` 选择
  - [x] 配置加载与安全策略注入
  - [x] 扩展扫描、内置工具注册、权限检查接线
- [x] 统一输出一个 runtime context，包含：
  - [x] `runtime`
  - [x] `store`
  - [x] `host`
  - [x] `executorRegistry`
  - [x] `config`
  - [x] `metadata`
- [x] 确保 `run` 与 `resume` 在相同配置下获得相同能力集

文件：

- `apps/pi-workflow-cli/src/runtime/create-workflow-runtime-context.ts`
- `apps/pi-workflow-cli/src/runtime/create-workflow-host.ts`
- `apps/pi-workflow-cli/src/runtime/create-workflow-executor-registry.ts`

### 6.2 任务 2：收口 CLI 命令层职责

- [x] 将 `run.ts` 收口为：
  - [x] 输入参数解析
  - [x] workflow 文档 / bundle / IR 加载
  - [x] input / config 读取
  - [x] 调用统一 runtime context 工厂
  - [x] 调用统一 runner
- [x] 将 `resume.ts` 收口为：
  - [x] 恢复参数解析
  - [x] run state 读取
  - [x] interaction input 读取
  - [x] 调用统一 runtime context 工厂
  - [x] 调用统一 runner
- [x] 移除命令层中分散的事件渲染状态变量与直接打印分支

### 6.3 任务 3：提升事件模型

- [x] 在 `packages/pi-workflow/src/events/types.ts` 上扩展 workflow shell 可消费的结构化事件表达
- [x] 保留现有 `node.progress`，不破坏现有文本链路
- [x] 为 shell 提供以下结构化信号：
  - [x] agent 文本增量
  - [x] agent tool start
  - [x] agent tool end
- [x] 第一阶段不单独展示 skill / MCP 细粒度事件
- [x] 明确并固化以下映射边界：
  - [x] backend 事件 -> `WorkflowHostEvent`
  - [x] `WorkflowHostEvent` -> `WorkflowRuntimeEvent`
  - [x] shell 只消费 `WorkflowRuntimeEvent`
- [x] 调整 `agent-executor.ts` 与 `pi-event-mapper.ts`，避免 TUI 依赖解析字符串消息猜语义

主要落点：

- [packages/pi-workflow/src/events/types.ts](../../../packages/pi-workflow/src/events/types.ts)
- [packages/pi-workflow/src/executors/agent-executor.ts](../../../packages/pi-workflow/src/executors/agent-executor.ts)
- [packages/pi-workflow/src/adapters/pi/pi-event-mapper.ts](../../../packages/pi-workflow/src/adapters/pi/pi-event-mapper.ts)
- [packages/pi-workflow/src/adapters/pi/types.ts](../../../packages/pi-workflow/src/adapters/pi/types.ts)

### 6.4 任务 4：新增 workflow runner

- [x] 在 CLI 层新增统一 workflow runner
- [x] runner 负责：
  - [x] 驱动 `runtime.run(...)`
  - [x] 驱动 `runtime.resume(...)`
  - [x] 将统一事件流转发给 renderer
  - [x] 汇总最终退出码与错误传播
- [x] 让命令层不再直接维护事件循环

文件：

- `apps/pi-workflow-cli/src/workflow-runner/workflow-runner.ts`

### 6.5 任务 5：新增 workflow shell 与 view-model

- [x] 在 `apps/pi-workflow-cli/src/tui/` 下新增 shell 与 view-model
- [x] 第一阶段 view-model 维护：
  - [x] workflow 标题、runId、状态
  - [x] 节点状态表
  - [x] 当前运行节点
  - [x] 当前 agent 文本缓冲
  - [x] 最近 tool 活动
  - [x] pause / resume / fail / complete 状态
- [x] 第一阶段 shell 展示：
  - [x] 工作流标题
  - [x] 当前运行节点
  - [x] 节点开始 / 完成 / 失败
  - [x] agent 文本增量
  - [x] tool start / end
  - [x] pause / resume
  - [x] complete / fail
- [x] 第一阶段 shell 不实现：
  - [x] agent 子视图
  - [x] 输入焦点路由
  - [x] 嵌套 agent 子会话

文件：

- `apps/pi-workflow-cli/src/tui/workflow-tui-shell.ts`
- `apps/pi-workflow-cli/src/tui/workflow-view-model.ts`
- `apps/pi-workflow-cli/src/tui/workflow-renderer.ts`

### 6.6 任务 6：保留 text renderer 兼容回退

- [x] 在统一 runner 下同时支持 `text` 与 `tui` 两类 renderer
- [x] 保证非 TTY、测试场景或回归定位时继续走文本渲染
- [x] 文本 renderer 应能将结构化事件降级渲染为原有输出风格，避免一次性破坏 CLI 使用习惯

### 6.7 任务 7：补齐第一阶段测试

- [x] CLI 侧测试重点覆盖：
  - [x] `run` 正常完成
  - [x] `pause -> resume`
  - [x] agent 文本流显示
  - [x] tool start / end 显示
  - [x] workflow failed
  - [x] `run` / `resume` 装配一致性
- [x] core 侧测试重点覆盖：
  - [x] 结构化事件产出
  - [x] 事件映射兼容性
  - [x] trace / replay 不失效
- [x] 补齐或新增以下测试入口：
  - [x] `apps/pi-workflow-cli/test/run.test.ts`
  - [x] `apps/pi-workflow-cli/test/resume.test.ts`
  - [x] `packages/pi-workflow/test/executors/agent-executor.test.ts`
  - [x] `packages/pi-workflow/test/debug/trace-model.test.ts`
  - [x] `packages/pi-workflow/test/debug/replay.test.ts`
  - [x] `packages/pi-workflow/test/adapters/pi/pi-event-mapper.test.ts`

### 6.8 任务 8：接入 PI 通用终端框架

- [ ] 识别并抽取 workflow 可直接复用的 PI 通用终端能力
- [ ] 为 workflow TUI 建立 app / layout / focus 的最小骨架
- [ ] 明确 workflow 外层与 text renderer 的切换策略
- [ ] 保证 workflow shell 是唯一终端控制者

### 6.9 任务 9：实现第二阶段交互能力

- [ ] 抽出可复用的 `createPiAgentSessionRuntime(...)` 设计
- [ ] 实现 `EmbeddedAgentSessionController` 的职责与生命周期
- [ ] 实现 `overview` / `workflow-input` / `agent-session` 三类输入焦点
- [ ] 实现 agent 子视图 model、事件来源与切换规则
- [ ] 固化 workflow 外层事件与 agent 子视图事件的双层模型边界
- [ ] 实现从 workflow 总览进入 agent 子视图、输入、返回总览

### 6.10 任务 10：文档与验收收尾

- [ ] 在代码落地后回写本计划状态
- [ ] 同步 `developers/PLANS/pi-workflow-phases/README.md`
- [ ] 补齐本阶段质量检查与验收证据
- [ ] 记录第二阶段后续实现入口

### 6.11 推荐提交顺序

1. `refactor(cli): unify workflow runtime/host/registry assembly`
2. `feat(core): add structured workflow events for shell consumption`
3. `feat(cli): add workflow runner and shell view-model`
4. `refactor(cli): switch run/resume to shared runner`
5. `test: add workflow shell and resume regression coverage`
6. `feat(cli): integrate pi-tui workflow shell foundation`
7. `feat(cli): add workflow overview app and focus routing`
8. `feat(core): add embedded agent session adapter`
9. `feat(cli): add workflow agent subview interaction`
10. `test: add workflow pi-tui interaction regression coverage`
11. `docs: sync phase 10.5 plan status`

---

## 7. 第二阶段实施口径

本节用于明确第二阶段的标准交付目标、用户可感知升级、实现路线与实施边界。第二阶段的目标是在 workflow shell 内部形成真正可交互的 workflow TUI 运行面，外层复用 PI 的通用终端框架，内层复用独立 `agent run` 已有的 `runtime/session` 底层能力。

### 7.1 第二阶段标准交付范围

第二阶段的标准交付范围包括：

1. 为 workflow 外层接入 PI 通用终端框架，交付真正的 workflow TUI 总览界面，而不是增强日志输出。
2. 为 workflow shell 新增正式的 agent 子视图能力，而不是临时弹出独立终端界面。
3. 将独立 `pi-tui` 主链路中的 runtime/session 创建逻辑拆成可复用层，供 workflow 子视图复用，同时保持独立 `agent run` 入口继续可用。
4. 新增嵌入式 agent 会话适配层，负责把 `ResolvedPiAgentAssembly` 转换为 workflow shell 可消费的子会话控制器。
5. 为 workflow shell 新增统一输入路由器，区分：
   - workflow 总览导航输入
   - workflow 级 `await_input` / resume 输入
   - agent 子会话输入
6. 为 shell 新增 agent 子视图 model 与双视图切换能力。
7. 建立 workflow 外层事件与 agent 子视图事件的双层事件模型，并保持对现有 `WorkflowRuntimeEvent` 消费方兼容。
8. 补齐第二阶段的总览、子视图、输入焦点与回归测试。

### 7.2 第二阶段硬约束

1. workflow shell 是唯一终端控制者。
2. 独立 `agent run` 命令入口与用户行为保持不变。
3. workflow 外层必须复用 PI 通用终端框架，不允许退化回 `console.log` 伪 TUI。
4. workflow 级输入与 agent 子会话输入必须由统一输入路由器分发。
5. workflow 外层继续消费 `WorkflowRuntimeEvent`，agent 子视图内部消费独立的子视图事件模型。
6. 第二阶段不改动阶段 3 的 pause/resume 协议。
7. 第二阶段复用 `runtime/session` 底层能力，不复用独立 TUI runner 外壳。
8. 第二阶段不嵌套 `InteractiveMode.run()`。

### 7.3 第二阶段总体实现路线

第二阶段按以下主链路实现：

1. workflow shell 继续作为唯一终端控制者。
2. workflow 外层先接入 PI 通用终端框架，形成真正的总览 TUI。
3. 当用户从 workflow 总览进入某个 `agent` 节点时，shell 创建一个嵌入式 agent session 控制器。
4. 该控制器底层复用 `createPiAgentSessionRuntime(...)` 与 session 订阅能力。
5. workflow shell 通过统一输入路由器，将当前键盘输入分发给：
   - workflow 总览导航
   - workflow 级 `await_input`
   - agent 子会话输入
6. agent 子视图负责展示 agent session 事件，并将输入转成 `session.prompt(...)`。
7. 用户退出子视图后，shell 返回 workflow 总览，终端控制权始终留在 workflow shell。

### 7.4 第二阶段目录设计

- 接入 PI 通用终端框架的 workflow 外层：
  - `apps/pi-workflow-cli/src/tui/workflow-tui-app.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-layout.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-focus-manager.ts`
- 抽出可复用的 agent runtime/session 创建函数：
  - `packages/pi-workflow/src/adapters/pi/pi-agent-session-runtime.ts`
- 新增嵌入式 agent 会话适配层：
  - `packages/pi-workflow/src/adapters/pi/embedded-agent-session.ts`
- 新增 shell 输入路由器：
  - `apps/pi-workflow-cli/src/tui/workflow-input-router.ts`
- 新增 agent 子视图 model：
  - `apps/pi-workflow-cli/src/tui/agent-subview-model.ts`
- 扩展 workflow shell：
  - `apps/pi-workflow-cli/src/tui/workflow-tui-shell.ts`
  - `apps/pi-workflow-cli/src/tui/workflow-view-model.ts`

### 7.5 第二阶段不接受的结果

1. 将 workflow TUI 实现为仅比文本模式多几行提示的增强日志输出。
2. 通过嵌套独立 `agent run` 的 `pi-tui` 或 `InteractiveMode.run()` 来实现 agent 子视图。
3. 让 agent 子链路直接接管终端输入输出，导致 workflow shell 失去唯一终端控制权。
4. 复用独立 TUI runner 外壳，而不是复用 PI 通用终端框架与 `runtime/session` 能力层。
5. workflow 级输入与 agent 子会话输入共用一个未区分的标准输入通道。
6. 第二阶段直接修改现有 `WorkflowRuntimeEvent` 字段语义而不保留兼容层。
7. 让第一阶段 text CLI、trace / replay 或现有测试夹具整体失效。

### 7.6 第二阶段实施任务

#### 7.6.1 任务 1：接入 PI 通用终端框架

- [ ] 建立 workflow 外层 `pi-tui` app 基础骨架
- [ ] 接入布局、焦点、输入与局部刷新能力
- [ ] 保持 text renderer 回退链路不受破坏

#### 7.6.2 任务 2：抽出可复用的 agent runtime/session 创建函数

- [ ] 将独立 `pi-tui` 链路拆为 `createPiAgentSessionRuntime(...)` 与 `runResolvedAssemblyInPiTui(...)`
- [ ] 保持独立 `agent run` 继续可用
- [ ] 为 workflow 子视图暴露可复用 runtime/session 创建入口

#### 7.6.3 任务 3：新增嵌入式 agent 会话适配层

- [ ] 新增 `EmbeddedAgentSessionController`
- [ ] 将 session 事件映射为 `EmbeddedAgentSessionEvent`
- [ ] 接通 `session.prompt(...)`
- [ ] 提供 attach / detach / dispose 生命周期管理

#### 7.6.4 任务 4：新增 workflow 输入路由器

- [ ] 新增 `workflow-input-router.ts`
- [ ] 冻结 `overview` / `workflow-input` / `agent-session` 三类焦点
- [ ] 保证任意时刻只有一个输入焦点拥有者
- [ ] 禁止多方直接读取 `process.stdin`

#### 7.6.5 任务 5：扩展 workflow shell 为双视图

- [ ] 在现有 shell 上新增 `overview` / `agent-detail` 双视图
- [ ] 支持从总览进入 agent 子视图
- [ ] 支持从 agent 子视图返回总览
- [ ] 返回总览后保留 shell 状态与子视图状态

#### 7.6.6 任务 6：新增 agent 子视图 model 与渲染

- [ ] 新增 `agent-subview-model.ts`
- [ ] 渲染消息流、工具调用、关键错误、终态与输入缓冲
- [ ] 不依赖 `node.progress.message` 字符串猜事件

#### 7.6.7 任务 7：补齐第二阶段测试

- [ ] 覆盖 workflow 总览 TUI 进入、刷新与退出
- [ ] 覆盖从 workflow 总览进入 agent 子视图
- [ ] 覆盖 agent 子视图发送输入
- [ ] 覆盖从子视图返回总览
- [ ] 覆盖 workflow `await_input` 与 agent 子会话输入焦点互斥
- [ ] 覆盖独立 `agent run` 主链路未被破坏

---

## 8. 风险与依赖

- 风险：
  1. 当前 agent 事件在 workflow 内部仍有一部分被压平成 `node.progress.message`；若不先提升结构化事件，第一阶段 TUI 会退化成彩色日志查看器。
  2. `run` 与 `resume` 目前各自手工构造 host/runtime；若不先收口，共用 shell 后会暴露能力不一致与恢复行为不一致问题。
  3. 若第一阶段直接尝试嵌套 `InteractiveMode.run()`，会引入终端控制权冲突，并显著提高第二阶段返工概率。
  4. workflow 级交互、权限确认、暂停恢复与 agent 子会话未来将共享终端输入；若第二阶段未提前冻结焦点路由，后续实现会出现控制权争抢。
  5. 若直接修改 `WorkflowRuntimeEvent` 现有字段语义而不保留兼容层，会同时影响 CLI 文本运行、trace / replay 与测试夹具。
  6. 若第二阶段错误地复用独立 TUI runner 外壳，而不是复用 runtime/session 能力层，会导致 workflow 子视图无法保持 shell 统一控制。
- 依赖：
  1. 依赖阶段 3 已稳定的 pause/resume/store 协议。
  2. 依赖阶段 10 已完成的 Assembly DSL、`PiRuntimeEvent` 与独立 `agent run` `pi-tui` 主链路。
  3. 依赖阶段 13 已完成的宿主工具注册与 `callTool()` 能力。
- 代码回滚风险（`[!WARNING]`：需回滚的操作/接口标注）：
  1. 若在未抽工厂前直接把 TUI 逻辑写入 `run.ts` / `resume.ts`，后续回滚会涉及命令实现、测试与宿主装配三处重复代码。
  2. 若在第一阶段直接让 workflow shell 绑定某个终端库的整屏控制接口，而不保留 renderer 抽象，第二阶段切换交互模式时回滚成本会很高。
  3. 若第二阶段让 agent 子链路直接读取标准输入，后续回滚将涉及 shell 主循环、子视图交互和 resume 输入三条链路。

---

## 9. 完成定义（DoD）

- [x] 第一阶段观察型 workflow shell 已形成正式主链路
- [x] `run` 与 `resume` 已共用同一套 runtime/host/registry/store 装配入口
- [x] workflow shell 已成为 `run` 与 `resume` 的统一渲染入口
- [x] 第一阶段观察型 shell 已能稳定展示节点生命周期、agent 增量、tool 调用、暂停 / 恢复与终态
- [x] 第一阶段结构化事件提升已具备兼容层，既有文本 CLI 链路与 trace / replay 不失效
- [x] 第一阶段未引入 skill / MCP 细粒度显示面
- [x] 第一阶段相关回归测试已补齐
- [ ] 第二阶段 workflow 总览 TUI 标准交付范围已确定并落地
- [ ] 第二阶段 PI 通用终端框架复用路线已确定并落地
- [ ] 第二阶段 runtime/session 复用路线已确定并落地
- [ ] 第二阶段 workflow shell 唯一终端控制原则已确定并落地
- [ ] 第二阶段输入焦点路由模型已确定并落地
- [ ] 第二阶段双层事件模型已确定并落地
- [ ] 第二阶段目录落点、接口边界、测试范围与不接受结果已冻结并同步
- [ ] 相关质量检查已完成
- [ ] 必要文档与索引已同步
- [ ] 已具备第二阶段验收条件

---

## 10. 验收结论

> 说明：本节记录第一阶段历史验收结论，并保留第二阶段规划状态。

- 验收时间：2026-06-10 19:30 +08:00（第一阶段）
- 技术栈：
- 目标完成情况：
  - [x] 目标 1：workflow 第一阶段观察型 TUI shell 已形成正式主链路
  - [x] 目标 2：`run` / `resume` 已收口到统一装配与渲染入口
  - [x] 目标 3：结构化事件已足以支撑第一阶段 shell 渲染，且兼容现有文本链路
  - [ ] 目标 4：第二阶段基于 PI 通用终端框架的 workflow 总览 TUI、agent 子视图、输入焦点路由与 runtime/session 复用层待落地
  - [ ] 目标 5：workflow shell 唯一终端控制原则待在第二阶段实现中验证，且不引入嵌套 `InteractiveMode.run()` 路线
- 非功能检查：
- 最终判定：第一阶段验收通过；第二阶段未验收
- 遗留事项：
  1. 第二阶段仍处于规划中，后续按“PI 通用终端框架 -> workflow 总览 TUI -> agent session/runtime 复用层 -> agent 子视图与输入路由”的顺序推进。
  2. 第一阶段已交付统一装配、统一 runner、观察型 shell 与结构化事件提升；后续第二阶段需在不破坏第一阶段 text 回退链路的前提下演进。
