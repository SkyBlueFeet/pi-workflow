---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 18:40 +08:00
- 代码快照日期：2026-05-26

---

# Pi Workflow 架构设计文档

> 原位于 `docs/pi-workflow-architecture.md`，按 DOC-RULES 规范移至 `developers/`。

## 1. 系统定义

`Pi Workflow` 是一个构建在 `pi` 宿主能力之上的任务编排解释器。

它的本质是一个可以执行、暂停、恢复、递归展开并对外输出运行事件的流程运行时。一次 `workflow run` 是一次完整执行过程，`agent` 节点是执行过程中的一次性委托调用节点。

系统的核心职责是：

1. 用一套 `pi-native DSL` 描述流程结构、节点行为、数据绑定和控制流。
2. 把 DSL 转换为统一的内部执行模型。
3. 以执行帧方式驱动节点运行、递归进入子结构、维护 shared context 与 artifacts。
4. 通过宿主适配层复用 `pi` 的 Agent、Session、Tool、Extension、UI 和 package resources。
5. 为后续 AI-first workflow authoring、静态检查、自动修复提供稳定底座。

演进路线由 `./pi-workflow-evolution.md` 维护，本文只描述架构定义与运行边界。

## 2. 架构目标

### 2.1 核心目标

`Pi Workflow` 要形成一套面向复杂任务的编排能力，具备以下特征：

1. 可运行：能加载定义、生成执行计划、驱动节点执行。
2. 可恢复：能在暂停后基于 checkpoint 与 run state 继续推进执行过程。
3. 可递归：复合节点可以展开为子执行过程。
4. 可扩展：节点类型、执行器、资源来源、DSL 都可以演进。
5. 可组合：支持子工作流、共享上下文、结构化产物流转。
6. 可嵌入：通过适配层接入 `pi` 的 Agent、Tool、Session、UI 与资源能力。
7. 可生成：为自然语言生成 workflow、静态校验和自动修复提供结构基础。

### 2.2 初始能力边界

系统的初始能力边界按确定性运行能力与宿主适配能力分层：

1. 定义最小 `pi-native DSL`。
2. DSL/IR 可表达 `agent`、`workflow`、`manual`、`return` 四类核心节点。
3. 支持依赖排序、输入绑定、artifact merge、pause/resume。
4. 明确一次 workflow run 是一次执行过程。
5. deterministic runtime 可执行 `manual/workflow/return`，并通过 unsupported executor 对尚未接入的节点能力返回 structured diagnostic。
6. PI adapter 通过 `AgentSession` 执行 agent 节点。
7. 通过独立 store 保存完整运行态，通过 `pi session` 保存恢复索引。
8. 将 `WorkflowDefine` 作为后续可选 importer 输入。

### 2.3 最终目标

最终系统应形成：

**通用任务编排能力 + Pi 级 Agent/Session 能力 + AI-first workflow authoring。**

也就是：

- 工作流定义可从自然语言生成。
- 运行态可追踪、可恢复、可演进。
- 节点能力可通过 `pi` 生态扩展。
- `pi-native DSL` 成为主定义格式。
- `WorkflowDefine` 可以通过 importer 作为外部定义输入。

## 3. 总体架构

`Pi Workflow` 由五层组成：

```text
Authoring Layer
DSL Layer
Workflow IR
Workflow Runtime
Pi Host Adapter
```

它们的关系是：

1. Authoring Layer 负责生成和修订 workflow。
2. DSL Layer 负责描述流程并转换为内部表示。
3. Workflow IR 负责承载统一的执行抽象。
4. Workflow Runtime 负责真正运行 workflow。
5. Pi Host Adapter 负责把 runtime 接到 `pi` 的能力面上。

### 3.1 Authoring Layer

这一层负责 workflow 的生成、修订、检查和演进。

它最终会包含：

- `WorkflowDraftGenerator`
- `WorkflowLinter`
- `WorkflowFixer`
- `WorkflowTemplateRegistry`
- `WorkflowRenderer`

它负责生产和维护可执行定义，并为 runtime 提供稳定输入。

### 3.2 DSL Layer

这一层负责定义与加载 `pi-native DSL`。

初始定义层主输入来源是 `pi-native DSL` 本身。

它的职责是：

1. 加载 workflow 文件。
2. 做 schema 校验和路径校验。
3. 解析节点、绑定、控制流、执行器配置。
4. 转换为统一 `Workflow IR`。

长期看，这一层承载：

- `pi-native DSL -> IR`
- `IR -> DSL/可视化表示`
- `WorkflowDefine -> IR` 可选 importer

### 3.3 Workflow IR

`Workflow IR` 是 `Pi Workflow` 的核心抽象层。它不依赖具体 DSL，也不依赖具体宿主实现。

它表达的内容包括：

1. 工作流定义。
2. 节点与依赖关系。
3. 输入输出绑定。
4. 执行器配置。
5. 状态、交互、artifact 和 shared context。
6. 递归执行时的子结构展开边界。

建议核心类型：

```ts
export interface WorkflowDefinitionIR {
  id: string;
  version: string;
  title: string;
  entryNodeIds: string[];
  nodes: WorkflowNodeIR[];
  edges: WorkflowEdgeIR[];
  finalOutput?: WorkflowOutputBindingIR;
}

export interface WorkflowNodeIR {
  id: string;
  title: string;
  kind: "agent" | "workflow" | "manual" | "tool" | "http" | "if" | "parallel" | "loop" | "return";
  dependsOn: string[];
  inputBindings: Record<string, ValueRef>;
  executor?: WorkflowExecutorIR;
  output?: WorkflowOutputBindingIR;
  control?: WorkflowControlIR;
  children?: string[];
}
```

IR 的意义是把"定义格式"与"运行模型"分离，使后续 DSL 演进不会影响 runtime 主体。

### 3.4 Workflow Runtime

这一层负责把 IR 变成可执行运行过程。

它由以下子模块组成：

- `loader`
- `planner`
- `scheduler`
- `executor-registry`
- `artifact-manager`
- `state-store`
- `event-emitter`
- `frame-manager`

其中：

- `loader` 负责接入 DSL 输出。
- `planner` 负责从 IR 生成执行计划。
- `scheduler` 负责推进节点状态。
- `executor-registry` 负责按节点类型分发执行器。
- `artifact-manager` 负责合并节点产物。
- `state-store` 负责保存运行态。
- `event-emitter` 负责向宿主输出运行事件。
- `frame-manager` 负责维护执行帧与递归调用关系。

### 3.5 Pi Host Adapter

这一层把 `pi` 作为宿主接到 workflow runtime 上。

它负责把 `pi` 的：

- `AgentSession`
- tools
- extensions
- session
- UI
- package resources

映射成 workflow runtime 需要的宿主能力。

runtime 通过稳定的 host contract 使用 `pi` 宿主能力。

## 4. pi-native DSL

### 4.1 设计原则

`pi-native DSL` 应首先服务运行时、生成、校验和可视化映射。

它要具备：

1. 面向执行过程建模。
2. 面向节点递归建模。
3. 面向数据引用建模。
4. 面向生成与校验建模。
5. 面向后续可视化映射建模。

### 4.2 最小顶层结构

建议最小 DSL 形态：

```json
{
  "id": "content-review",
  "version": "1",
  "title": "Content Review",
  "entry": "root",
  "nodes": [
    {
      "id": "root",
      "type": "workflow",
      "children": ["collect-input", "draft-review", "finalize"]
    }
  ]
}
```

建议顶层字段：

- `id`
- `version`
- `title`
- `entry`
- `nodes`
- `defaults`
- `resources`
- `settings`

### 4.3 最小节点类型

初始 DSL 建议直接定义以下节点类型：

- `workflow`
- `agent`
- `manual`
- `return`

通用编排能力可扩展支持：

- `tool`
- `http`
- `if`
- `parallel`
- `loop`

### 4.4 ValueRef 统一绑定模型

建议将数据引用统一为 `ValueRef`：

```ts
export type ValueRef =
  | { from: "run.input"; path?: string }
  | { from: "context"; path?: string }
  | { from: "node.output"; nodeId: string; path?: string }
  | { from: "frame.local"; path?: string }
  | { from: "literal"; value: unknown };
```

它统一解决：

- 节点输入绑定
- 条件判断
- 子工作流参数传递
- loop 数据源
- return 输出绑定

### 4.5 节点示例

`agent` 节点示例：

```json
{
  "id": "draft-review",
  "type": "agent",
  "title": "Draft Review",
  "prompt": {
    "inline": "根据输入内容生成结构化审查意见。"
  },
  "input": {
    "content": { "from": "run.input", "path": "content" }
  },
  "output": {
    "to": "context.review"
  }
}
```

`workflow` 节点示例：

```json
{
  "id": "collect-input",
  "type": "workflow",
  "title": "Collect Input",
  "input": {
    "content": { "from": "run.input", "path": "content" }
  },
  "children": ["normalize-input", "validate-input"]
}
```

`return` 节点示例：

```json
{
  "id": "finalize",
  "type": "return",
  "value": { "from": "context", "path": "review" }
}
```

## 5. 核心运行模型

### 5.1 执行过程模型

一次 `workflow run` 是一次完整的执行过程。

它更接近：

```ts
runWorkflow(definition, input) => WorkflowRunResult
```

也就是说：

- workflow run 是顶层运行单元；
- runtime 是这次执行过程的解释器；
- 节点是在执行过程中被调度和调用；
- `agent` 节点是一次性委托调用节点，由 runtime 掌握主控制权。

### 5.2 执行帧模型

为了支持递归、子工作流、并行分支和循环体，runtime 应显式维护 `ExecutionFrame`。

建议把 frame 理解为一次局部执行上下文：

- root workflow 是一个 frame
- subworkflow 是一个 child frame
- parallel branch 是一个 child frame
- loop body 是一个 child frame

建议核心结构：

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

这样 runtime 通过执行帧栈推进运行过程。

### 5.3 基本运行流程

`Pi Workflow` 的标准运行流程是：

1. 加载 workflow 定义。
2. 将定义转换为 `Workflow IR`。
3. 基于 IR 生成执行计划。
4. 创建 root frame。
5. 初始化 shared context 和 workflow run state。
6. 调度当前 frame 中可执行节点。
7. 执行 primitive node，或为 composite node 创建 child frame。
8. 节点执行后产出 artifacts 和状态变化。
9. artifacts 合并回 shared context。
10. 若遇到缺失输入或显式交互，则进入 paused。
11. 恢复后从当前 frame 的当前节点继续执行。
12. 全部 frame 完成后输出 final output。

### 5.4 节点分类模型

节点应分为两类：

1. `primitive node`
2. `composite node`

`primitive node` 直接执行并返回结果：

- `agent`
- `manual`
- `tool`
- `http`
- `return`

`composite node` 负责展开新的子执行过程：

- `workflow`
- `if`
- `parallel`
- `loop`

这意味着：

- primitive node 是执行单元
- composite node 是结构单元

只有 composite node 会创建 child frame。

### 5.5 Shared Context 模型

shared context 是整个 workflow 的运行时上下文，用于跨节点传递结构化信息。

它承载：

- 主输出对象
- artifacts 列表
- diagnostics
- open questions
- 其他跨节点共享变量

shared context 是执行过程中的结构化状态承载区。

### 5.6 Artifact 模型

每个节点执行完成后都可以产出一个或多个 `artifact`。

artifact 具备以下属性：

- `type`
- `data`
- `targetPath`
- `mergeStrategy`
- `summary`

artifact 的职责是：

1. 作为节点输出的结构化表示。
2. 作为 shared context 的写入单元。
3. 作为恢复、调试和追踪的重要诊断对象。

### 5.7 Interaction 模型

workflow 运行中需要外部输入时，生成一个 `interaction` 并进入可恢复的 paused 状态。

interaction 至少包含：

- `interactionId`
- `nodeId`
- `question`
- `expectedFormat`
- `options`
- `required`

这让 workflow 可以从即时执行扩展为可挂起、可恢复的长任务编排。

## 6. 执行器模型

节点的真正执行由 executor 完成。executor 分为 deterministic executor 与宿主适配 executor 两类：前者用于本地确定性节点，后者通过 PI adapter 接入 Agent、Tool、Session 与资源能力。

### 6.1 Agent Executor

`agent` 节点用于调用大模型 Agent 完成生成、判断、提炼、规划等任务。

在这个架构里，`agent` 节点是一次性委托执行：

```ts
invokeAgent(nodeConfig, nodeInput, currentContext) => NodeExecutionResult
```

它只负责：

1. 接收当前节点输入。
2. 结合当前 frame 和 shared context 生成调用请求。
3. 执行一次 agent invocation。
4. 返回结果、进度事件、交互事件或失败信息。
5. 将结果合并回当前 workflow run。

PI-backed agent executor 采用 `managed-session` 模式：

- 由 adapter 创建或复用受控 `AgentSession`
- 拼装节点 prompt、输入和上下文摘要
- 订阅 `AgentSession` 事件流
- 将其转换为 workflow runtime event
- 最终生成文本或 JSON artifact

### 6.2 Workflow Executor

`workflow` 节点用于递归执行子工作流。

它使 workflow 具备层次化编排能力：

- 父 workflow 调用子 workflow
- 为子工作流创建 child frame
- 子 workflow 独立执行并返回 final output
- 返回结果包装成父节点 artifact
- paused/failed 状态向父级传播

### 6.3 Manual Executor

`manual` 节点用于执行本地可信逻辑。

适用场景：

- 格式整理
- 规则计算
- 条件判断
- 本地系统桥接
- 复杂产物合并

它通过统一的 AsyncGenerator 接口输出：

- `progress`
- `await-input`
- `forward-event`
- `completed`
- `paused`
- `failed`

### 6.4 Return Executor

`return` 节点用于结束当前 frame，并返回该 frame 的输出值。

它的职责是：

1. 读取一个 `ValueRef`
2. 生成当前 frame 的返回值
3. 将返回值作为 workflow 或子工作流的 final output

## 7. 状态与恢复架构

### 7.1 状态分层

`Pi Workflow` 采用双层状态模型：

1. `pi session` 保存轻量 checkpoint 索引。
2. `workflow store` 保存完整 workflow run state。

这样可以同时满足：

- `pi` 原有 session/branch/fork 的轻量性
- workflow 运行态的完整性和可恢复性

### 7.2 Session Checkpoint

session 中保存的 checkpoint 索引建议为：

```ts
export interface WorkflowSessionCheckpoint {
  workflowRunId: string;
  workflowId: string;
  nodeId?: string;
  status: "running" | "paused" | "completed" | "failed";
  interactionId?: string;
  storeKey: string;
  summary?: string;
  updatedAt: string;
}
```

### 7.3 Workflow Run State

完整运行态保存在独立 store 中：

```ts
export interface WorkflowRunState {
  workflowRunId: string;
  workflowId: string;
  workflowVersion?: string;
  workflowDefinitionHash?: string;
  status: "running" | "paused" | "completed" | "failed";
  frameStack: ExecutionFrame[];
  currentFrameId: string;
  currentNodeId?: string;
  nodeResults: Record<string, NodeExecutionResult>;
  workflowInput: Record<string, unknown>;
  sharedContext: Record<string, unknown>;
  artifacts: WorkflowArtifact[];
  pendingInteraction?: WorkflowInteraction;
  resumePolicy: "reenter-node";
  createdAt: string;
  updatedAt: string;
}
```

### 7.4 恢复语义

初始恢复采用节点边界重入模型：

1. 通过 `workflowRunId + interactionId` 定位 paused run。
2. 读取完整 run state。
3. 恢复当前 frame。
4. 将恢复输入绑定到当前节点。
5. 从当前节点重新执行。
6. 已完成前序节点不重跑。

## 8. 事件模型

workflow runtime 内部使用统一事件协议：

```ts
export type WorkflowRuntimeEvent = ({ timestamp?: string } & (
  | { type: "workflow.started"; workflowRunId: string; workflowId: string }
  | { type: "workflow.resumed"; workflowRunId: string; workflowId: string }
  | { type: "frame.entered"; workflowRunId: string; frameId: string; frameType: string; parentFrameId?: string }
  | { type: "node.started"; workflowRunId: string; nodeId: string; title?: string }
  | { type: "node.progress"; workflowRunId: string; nodeId: string; message: string; delta?: string }
  | { type: "node.await_input"; workflowRunId: string; nodeId: string; interaction: WorkflowInteraction }
  | {
      type: "node.completed";
      workflowRunId: string;
      nodeId: string;
      input?: Readonly<Record<string, unknown>>;
      output?: unknown;
      contextSnapshot?: Readonly<Record<string, unknown>>;
      artifacts?: WorkflowArtifact[];
    }
  | { type: "node.failed"; workflowRunId: string; nodeId: string; error: string; input?: Readonly<Record<string, unknown>> }
  | { type: "frame.completed"; workflowRunId: string; frameId: string }
  | { type: "workflow.paused"; workflowRunId: string; interaction: WorkflowInteraction }
  | { type: "workflow.completed"; workflowRunId: string; finalOutput?: unknown }
  | { type: "workflow.failed"; workflowRunId: string; error: string }
));
```

`timestamp`、节点 resolved input、runtime output 与 `contextSnapshot` 是阶段 8 增加的向后兼容调试字段，用于 trace 时间精度、节点详情查看和 context diff。旧事件消费者可以忽略这些可选字段。

Pi adapter 再将这些事件映射到：

- interactive UI
- custom message renderer
- RPC/SSE
- session custom entry

## 9. Pi 宿主能力模型

runtime 通过基础 `WorkflowHostCapabilities` 使用宿主事件能力。确定性 runtime 的最小 host contract 如下：

```ts
export interface WorkflowHostCapabilities {
  emitEvent?(event: WorkflowRuntimeEvent): void | Promise<void>;
}
```

PI adapter 在基础 host contract 之上提供扩展能力，不替代基础接口：

```ts
export interface WorkflowPiHostCapabilities extends WorkflowHostCapabilities {
  runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
  callTool?(request: WorkflowToolRequest): Promise<WorkflowToolResult>;
  listResources?(query: WorkflowResourceQuery): Promise<WorkflowResourceRef[]>;
  resolveResource?(ref: WorkflowResourceRef): Promise<WorkflowResolvedResource>;
  requestUserInput?(request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult>;
  appendSessionCheckpoint?(checkpoint: WorkflowSessionCheckpoint): Promise<void>;
  readSessionCheckpoints?(): Promise<WorkflowSessionCheckpoint[]>;
}
```

在 `pi` 中，这些能力对应为：

- `runAgent()` -> `AgentSession` / 受控 session
- `callTool()` -> 当前 active tools
- `listResources()` / `resolveResource()` -> 当前已启用 package resources
- `requestUserInput()` -> interactive UI 或 paused 语义
- `appendSessionCheckpoint()` -> extension custom entry
- `emitEvent()` -> UI、RPC、SSE、日志

实现上按能力分层落地：确定性 runtime 只依赖基础 `WorkflowHostCapabilities`；interaction、Agent、Tool、Resource 和 session checkpoint 能力由 store/resume 与 PI adapter 扩展接入。缺少扩展能力时，对应 executor 返回 structured unsupported diagnostic，而不是要求基础 host 实现后续能力。

## 10. Resource Integration

`Pi Workflow` 支持消费当前 `pi` 会话已启用的 package resources，以增强节点能力。

建议资源引用结构：

```ts
export interface WorkflowResourceRef {
  kind: "skill" | "prompt" | "tool" | "extension-capability";
  name: string;
  packageSource?: string;
  resourcePath?: string;
}
```

这一层的角色是扩展 workflow 能力，不改变 workflow 本身的核心定位。

当前代码已具备 PI adapter contract、mock host、agent executor、capability catalog 和 tool 调用抽象；真实 PI npm SDK、package resolver、resource loader bridge 与独立 `src/resources/` 模块仍受私有 SDK 入口稳定性影响，作为后续接入增强项推进。

### 10.1 Node Capability Package

除 skill、prompt、tool 和 extension-capability 等资源型扩展外，`Pi Workflow` 在后续演进中还应支持一种更高层的扩展形态：**节点能力包**。

这里的目标不是让所有新能力都回到 core 内置，而是允许某一类领域能力以独立包形式存在，由包对外提供新的 workflow 节点语义与作者态能力说明。

这一能力面向的典型场景包括：

1. 面向 OpenAPI / Swagger 的接口工作流节点。
2. 面向网页采集、浏览器自动化、文档处理等垂直领域节点。
3. 面向企业内部平台、SaaS 服务或业务网关的专用节点集合。
4. 面向 AI 工作流的高层语义节点，例如结构化抽取、外部任务提交、审批流接入等。

它的核心价值在于：

1. 将通用 runtime 与垂直领域能力解耦，避免 core 被大量场景化节点持续侵入。
2. 让节点能力可以独立演进、独立发布、独立版本管理。
3. 让不同团队以 package 为边界维护自己的节点目录，而不是直接修改主仓库核心类型。
4. 让 workflow 作者在统一 DSL 视角下复用外部能力，而不需要感知底层包内组织方式。

从使用者角度看，节点能力包应带来以下可见能力：

1. 在 workflow 作者态可声明“使用某类外部节点能力”。
2. 工作流定义可以引用这些节点能力，而不仅限于 core 当前内置节点集合。
3. 节点能力包可以附带自身的说明文档、输入输出约束、使用边界和适用场景。
4. 同一工作流可组合内置节点与包提供的节点，共同参与编排。

这一设想强调的不是“任意代码注入”，而是“以 package 为交付边界的受控节点能力扩展”。因此其架构定位应满足以下边界：

1. `pi-workflow` core 仍然负责 workflow 的主定义格式、运行时调度、状态恢复、事件协议与安全边界。
2. 节点能力包负责表达某类新增节点的业务语义，而不是接管整个 runtime。
3. 资源型扩展与节点型扩展需要区分：前者增强已有节点可用资源，后者扩展 workflow 可表达的节点能力。
4. 包提供的节点能力应被视为 workflow 生态扩展，而不是对 core 架构边界的替代。

在产品定位上，这一能力将使 `Pi Workflow` 从“具备固定节点集合的工作流运行时”演进为“以稳定 core 为底座、以 package 扩展节点生态的工作流平台”。

当前阶段先明确该能力的架构目标与边界，不在本文展开具体装配方式、注册协议和实现细节。

## 11. 工程落点

推荐保持独立模块边界。

当前仓库采用独立 npm 工程落点：

```text
packages/
  pi-workflow/
    src/
      dsl/
      ir/
      runtime/
      executors/
      artifacts/
      events/
      store/
      host/
      adapters/
        pi/
      authoring/
      importers/
      resources/              # 预留，真实 PI package resources 接入后落地
    test/
    examples/
apps/
  pi-workflow-cli/
```

`src/adapters/pi` 是正式 PI npm adapter 模块。历史开发日志或旧版本计划中出现的 `pi/packages/pi-workflow` 仅作为早期备选口径，不作为当前实施落点。

## 12. 运行原则

以下原则用于保持架构定义与实现路径一致：

1. DSL/IR 可以表达 `agent`，PI-backed agent 执行通过 adapter 接入。
2. subagent 能力作为 Agent Executor 的增强通道。
3. host-neutral session checkpoint 保存轻量索引，workflow store 保存完整运行态；PI session 的具体映射由 adapter 层负责。
4. 初始恢复采用节点边界重入。
5. package resources 作为资源扩展入口，正式 PI package 字段由 adapter/resource 设计定稿。
6. `WorkflowDefine` importer 作为外部定义接入通道。
7. 递归执行需要显式控制最大深度、并行度和取消传播。
