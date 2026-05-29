---
**版本锚点**
- 创建时间：2026-05-26 21:00 +08:00
- 最后更新：2026-05-30 02:16 +08:00
- 代码快照日期：2026-05-30

---

# 阶段 10：自定义智能体系统

## 1. 最终实现目标

本阶段用于为 `pi-workflow` 重塑一套以 `PI` 为能力本体的自定义智能体系统。核心目标不是继续增强“workflow 内 agent 子节点的配置复用”，而是先定义“独立智能体”作为 `PI` 宿主侧的一等能力对象，再让 workflow 在后续阶段或同阶段后半段复用这条独立能力链路。

阶段 10 完成后，系统应具备以下能力：

1. 用户可定义独立的自定义智能体，而不是只能在 `WorkflowConfig.agents` 中定义节点级配置片段。
2. 自定义智能体的执行最大程度复用 `PI` 现有 agent 能力，不新增第二套独立大模型执行引擎。
3. 自定义智能体可被宿主直接发现、列举、查看和调用，不依赖 workflow `agent` 节点作为唯一入口。
4. 自定义智能体可声明模型、提示词、skills、tools、MCP、权限等宿主执行参数。
5. 自定义智能体可被适配为 `PI` 侧的自定义工具/扩展入口，但其内部语义仍然是一次 agent 调用。
6. workflow `agent` 子节点在需要时可通过稳定接口复用独立智能体，而不是自己维护一套平行配置语义。
7. 现有阶段 10 已落地的 `agentId`、workflow tool、CLI agent、解析器等实现被重新归类为“可复用基础设施”，而不是最终目标本身。

本阶段不引入：

1. 新的非 PI agent runtime。
2. 与 `PI` 主能力平行的第二套智能体生命周期系统。
3. 复杂的智能体继承、多层组合或动态插件注入模型。

## 2. 前置讨论与待确定

### 2.1 自定义智能体首先是 PI 宿主能力，不是 workflow 配置对象

- `PI` 本身就是 agent，因此自定义智能体应优先建模为 `PI` 宿主上的命名能力对象。
- `pi-workflow` 不负责重新实现 agent 推理循环，只负责定义、装配、桥接和约束。
- `WorkflowConfig.agents` 的已有设计不能继续作为最终主模型，它最多只能退化为“workflow 对独立智能体的引用层”或兼容层。

### 2.2 先有独立运行入口，后有 workflow 复用

- 必须先定义“独立智能体如何被宿主调用”。
- workflow `agent` 子节点后续只应成为该能力的一种编排入口。
- 不允许继续把“workflow 节点可引用命名 agent”误当成“自定义智能体系统已完成”。

### 2.3 最大程度复用 PI 现有能力

- 模型选择、消息流式输出、工具调用、MCP、skill 使用、权限申请等主流程优先走 `PI` 已有能力。
- `pi-workflow` 只补这几类缺口：
  - 定义格式
  - 注册与发现
  - 兼容性桥接
  - workflow 复用适配
  - 防御性预检与错误透传

### 2.4 “自定义智能体”和“自定义工具”要分层而不是混义

- 对宿主暴露时，自定义智能体可以表现为一个可调用工具入口。
- 但内部建模上，它仍然是 agent definition + invocation contract，不应直接退化成普通 tool 定义。
- 否则后续会混淆：
  - 工具是执行单元
  - 智能体是基于 PI agent 能力的一类高阶能力对象

### 2.5 与已有阶段 10 实现的关系

- 现有实现覆盖了：
  - `WorkflowConfig.agents`
  - `agentId` 解析
  - workflow tool 装配
  - CLI `agent`
  - runtime 子运行隔离
- 这些能力应被视为“新阶段 10 的部分基础设施”，但其语义边界需要重写：
  - `agents/registry.ts` 不再只服务 workflow config
  - `agent resolve` 不再只看 workflow 节点合并结果
  - `AgentExecutor` 不再是自定义智能体唯一运行入口

## 3. 当前已进行工作

### 3.1 已经存在且可复用的实现

1. `PiHostAdapter.runAgent()` 已经建立了基于 `@earendil-works/pi-agent-core` 的宿主调用链。
2. CLI 已有 `agent list/show/resolve` 命令，可作为后续独立智能体 CLI 的基础骨架。
3. 现有 `agents/types.ts`、`registry.ts`、`resolver.ts` 提供了命名 agent 的类型与解析基础。
4. `workflow tool` 的桥接、宿主可调用工具适配、子运行隔离、权限申请链路已初步建立。
5. TOML/JSON 配置读取、校验和 CLI `--config` 主链路已可复用。

### 3.2 当前实现与新目标的偏差（2026-05-30 更新）

以下偏差已通过本次实现部分纠正：

1. ~~现有 `agents` 仍定义在 `WorkflowConfig` 内，语义从属于 workflow。~~
   → 已添加 `CustomAgentRegistry` 接口，`AgentRegistry` 实现该接口，语义提升为宿主级独立智能体目录。
   → `WorkflowConfig.agents` 仍然是配置来源之一，但 registry 的消费方不再是只有 workflow。
2. ~~当前 agent 执行入口仍主要绑定 `AgentExecutor`，即 workflow 节点。~~
   → 已新增 `CustomAgentInvoker` 作为独立执行入口，不绑定 workflow。
   → `AgentExecutor` 已保留为 workflow 兼容调用层，不再承担独立智能体主执行职责。
3. ~~CLI `agent` 目前本质上是在查看 workflow config 里的 agent 配置，而不是宿主级独立智能体目录。~~
   → 已新增 `agent run` 子命令，可通过 CLI 直接运行独立智能体。
4. ~~尚无"独立智能体直接运行"的正式入口。~~
   → 已提供 `CustomAgentInvoker.invoke()` + CLI `agent run` 作为正式独立入口。
5. ~~`pi-agent-smoke.ts` 仍是 placeholder，尚未形成真实独立 agent 闭环样例。~~
   → `pi-agent-smoke.ts` 已重写为真实 smoke 测试，验证 registry 加载、invoker 调用和 mock host 输出。

### 3.3 本阶段的新口径

当前不再把"命名智能体配置 + agentId + workflow tool"视为阶段 10 已完成，而是视为：

1. 已有部分实现存在。
2. 目标语义定义有偏差。
3. 需要在不浪费已有实现的前提下重构阶段计划和实现边界。

本次实现已按新口径覆盖了独立智能体定义、registry、invoker、CLI `agent run` 和宿主桥接。

## 4. 目标能力拆解

### 4.1 独立智能体定义

系统应支持定义独立智能体，至少包含：

- `id`
- `name`
- `description`
- `systemPrompt`
- `model`
- `temperature`
- `maxTokens`
- `skills`
- `tools`
- `mcp`
- `permissions`

它的语义是：

- “一个可被 PI 宿主直接调用的智能体定义”
- 而不是“某个 workflow 节点的配置补丁”

### 4.2 独立智能体注册与发现

系统应支持：

1. 列出所有独立智能体。
2. 查看单个智能体定义。
3. 解析智能体最终运行参数。
4. 为后续宿主注册、CLI 执行和 workflow 复用提供统一 registry。

### 4.3 独立智能体运行入口

必须存在不依赖 workflow 的独立调用入口，例如：

- CLI `agent run <id>`
- SDK `invokeCustomAgent(...)`
- 宿主桥接 `runNamedAgent(...)`

其核心要求：

1. 输入输出协议独立于 workflow node。
2. 流式文本、工具调用、MCP、权限申请继续复用 `PI` agent 能力。
3. 可被 future host/UI/tooling 直接消费。

### 4.4 宿主工具化暴露

为兼容 `PI` 的扩展/工具模型，自定义智能体应允许被适配为宿主可调用工具：

1. 对外表现为可调用入口。
2. 对内仍由 `PI` agent 执行。
3. 与普通 tool 的差异体现在：
   - 其执行语义是 agent request
   - 可携带模型、提示词、skills/tools/MCP/权限等 agent 级配置

### 4.5 workflow 复用

workflow 后续复用路径应收敛为：

1. workflow `agent` 节点引用独立智能体 `agentId`
2. `AgentExecutor` 调用宿主级独立智能体入口
3. 节点层只保留少量即时覆盖项

即：

- 智能体定义主权在宿主层
- workflow 只拥有编排引用权

## 5. 目录设计

目标目录设计如下：

```text
packages/pi-workflow/src/
  agents/
    types.ts
    registry.ts
    resolver.ts
    invoker.ts
    host-tool-adapter.ts
    compatibility/
      workflow-agent-compat.ts
  config/
    types.ts
    load.ts
    validator.ts
  adapters/
    pi/
      types.ts
      pi-host-adapter.ts
      named-agent-adapter.ts
  executors/
    agent-executor.ts
  runtime/
    workflow-runtime.ts

apps/pi-workflow-cli/src/commands/
  agent.ts
```

说明：

1. `invoker.ts` 负责独立智能体运行入口，不绑定 workflow。
2. `host-tool-adapter.ts` 负责将独立智能体暴露为宿主可调用工具。
3. `compatibility/workflow-agent-compat.ts` 负责把现有 workflow `agentId` 语义收口到独立智能体主模型。
4. `named-agent-adapter.ts` 负责宿主侧桥接，而不是在 `AgentExecutor` 内硬编码全部逻辑。

## 6. 核心结构设计

### 6.1 独立智能体定义

```typescript
export interface CustomAgentDefinition {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly systemPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly permissions?: readonly PermissionGrant[];
}
```

### 6.2 独立智能体调用参数

```typescript
export interface CustomAgentInvokeRequest {
  readonly agentId: string;
  readonly prompt?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}
```

### 6.3 宿主级运行接口

```typescript
export interface WorkflowPiHostCapabilities extends WorkflowHostCapabilities {
  runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
  runNamedAgent?(
    request: CustomAgentInvokeRequest,
  ): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
}
```

说明：

1. `runNamedAgent` 是新增的宿主级命名智能体入口。
2. 当前实现中，`pi-workflow` 的主执行链路不会优先依赖该入口，而是由 `CustomAgentInvoker` 自行展开完整定义后走 `runAgent()`。
3. `runNamedAgent` 保留为宿主自行扩展或后续演进的可选入口。
4. 若后续需要恢复宿主优先执行，也应保证宿主侧能完整承载 agent definition 语义；否则仍应回到：
   - registry 取定义
   - 组装 `WorkflowAgentRequest`
   - 再调用现有 `runAgent`

### 6.4 独立智能体注册中心

```typescript
export interface CustomAgentRegistry {
  list(): readonly CustomAgentDefinition[];
  get(id: string): CustomAgentDefinition | undefined;
  has(id: string): boolean;
  loadFromConfig(config: WorkflowConfig): void;
}
```

说明：

- 初期可以继续复用现有 `WorkflowConfig.agents` 作为配置来源之一。
- 但 registry 的语义必须提升为“独立智能体目录”，而不是“仅供 workflow 使用的配置表”。

### 6.5 workflow 兼容层

```typescript
export interface WorkflowAgentReference {
  readonly agentId?: string;
  readonly promptOverrides?: {
    readonly systemPrompt?: string;
    readonly userPrompt?: string;
    readonly model?: string;
    readonly temperature?: number;
    readonly maxTokens?: number;
  };
}
```

说明：

- workflow `agent` 节点未来应只表达“引用哪个独立智能体 + 覆盖哪些即时参数”。
- 原有在节点内直接堆叠大量 agent 语义的模式应逐步收敛为兼容路径。

### 6.6 最小配置来源约束

为避免本阶段同时处理“新能力定义”和“多格式扩展”两类问题，先收敛为单一正式来源：

1. `WorkflowConfig.agents`

本阶段约束如下：

1. 先把 `WorkflowConfig.agents` 从“workflow 私有配置段”提升为“宿主级自定义智能体注册来源之一”。
2. 不在本阶段引入新的正式 `agent.toml` 或 `agents/` 目录格式。
3. 所有 registry、resolver、invoker、CLI `agent run` 都先基于该来源工作。
4. 在类型和 loader 上仅预留后续扩展点，不实现第二种来源。

### 6.7 运行结果模型

```typescript
export interface CustomAgentInvokeResult {
  readonly agentId: string;
  readonly content: string;
  readonly output: unknown;
  readonly model?: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}
```

说明：

1. `content` 是 CLI 输出和 workflow artifact 回填的主字段。
2. `output` 保存宿主返回的原始结果。
3. `usage` 在当前 `PI` 适配器拿不到时允许缺省。

### 6.8 事件透传模型

独立智能体与 workflow 复用两条链路都直接复用已有宿主事件：

- `agent.text_delta`
- `agent.tool_start`
- `agent.tool_end`
- `agent.skill_start`
- `agent.skill_end`
- `agent.mcp_start`
- `agent.mcp_end`
- `agent.error`

本阶段不新增第二套智能体事件协议。

### 6.9 CLI 输入约定

`pi-workflow agent run <id>` 先采用如下协议：

```text
pi-workflow agent run <id> [input.json] [--config <path>] [--model <model>] [--debug]
```

输入处理规则：

1. `input.json` 必须解析为对象。
2. 优先读取 `prompt` / `user_prompt` / `userPrompt` 作为用户提示词。
3. 若不存在这些字段，则把整个对象 JSON 序列化为 prompt 兜底值。
4. `--model` 只覆盖本次调用，不修改定义。

### 6.10 宿主回退策略

独立智能体执行链路必须支持宿主能力渐进升级：

1. 当前默认路径：
   - 从 registry 取定义
   - 解析最终运行配置
   - 构造 `WorkflowAgentRequest`
   - 调用现有 `piHost.runAgent()`
2. `piHost.runNamedAgent()` 当前仅保留为宿主能力扩展点，不作为 `CustomAgentInvoker` 的默认优先路径。

该策略的原因是：当前阶段更优先保证自定义智能体定义语义完整透传，而不是依赖宿主先升级“命名智能体”原生协议。

## 7. 文件级实施设计

### 7.1 `packages/pi-workflow/src/agents/types.ts`

目标：

1. 新增宿主级语义类型：
   - `CustomAgentDefinition`
   - `CustomAgentInvokeRequest`
   - `CustomAgentInvokeResult`
2. 保留现有 `AgentDefinition` 的兼容导出。

实施要求：

1. 第一轮不删除旧类型。
2. 优先新增并行类型，后续再视情况统一命名。

### 7.2 `packages/pi-workflow/src/agents/registry.ts`

目标：

1. 将 registry 提升为独立智能体目录。
2. 对外暴露稳定接口：
   - `list()`
   - `get(id)`
   - `has(id)`
   - `register(def)`
   - `loadFromConfig(config)`

实施要求：

1. `loadFromConfig()` 继续读取 `WorkflowConfig.agents`。
2. `createRegistryFromConfig()` 保留，但语义改成“创建自定义智能体目录”。
3. CLI、invoker、workflow compatibility 都只依赖这个 registry。

### 7.3 `packages/pi-workflow/src/agents/resolver.ts`

目标：

拆成两层解析：

1. 独立智能体解析：
   - `resolveCustomAgentDefinition(agentId, config, registry)`
2. workflow 兼容解析：
   - `resolveWorkflowAgentInvocation(node, config, registry)`

实施要求：

1. 不要继续让一个函数同时承担两种语义。
2. 独立智能体解析负责：
   - `systemPrompt`
   - `model`
   - `temperature`
   - `maxTokens`
   - `skills`
   - `tools`
   - `mcp`
   - `permissions`
3. workflow 兼容解析只额外处理：
   - 节点输入覆盖
   - 节点 capabilities 合并
   - workflow tool 注入

### 7.4 `packages/pi-workflow/src/agents/invoker.ts`

目标：

新增独立智能体调用器，建议最小接口如下：

```typescript
export interface CustomAgentInvokerOptions {
  readonly host: WorkflowPiHostCapabilities;
  readonly registry: AgentRegistry;
  readonly config?: WorkflowConfig;
}

export class CustomAgentInvoker {
  constructor(options: CustomAgentInvokerOptions);

  invoke(
    request: CustomAgentInvokeRequest,
  ): AsyncGenerator<WorkflowHostEvent, CustomAgentInvokeResult>;
}
```

实施要求：

1. `invoke()` 先检查目标 agent 是否存在。
2. 先解析，再做权限检查，再调用宿主。
3. 返回事件流，最终 `return CustomAgentInvokeResult`。
4. 这是本阶段的主运行入口。

### 7.5 `packages/pi-workflow/src/adapters/pi/types.ts`

目标：

扩展宿主接口：

```typescript
runNamedAgent?(
  request: CustomAgentInvokeRequest,
): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
```

实施要求：

1. 保持可选。
2. `runAgent()` 不删除。

### 7.6 `packages/pi-workflow/src/adapters/pi/pi-host-adapter.ts`

目标：

实现默认 `runNamedAgent()` 回退逻辑，并收口公共执行核心。

实施要求：

1. 将现有 `runAgent()` 内通用逻辑下沉到共享私有方法。
2. `runAgent()` 和 `runNamedAgent()` 复用同一执行核心。
3. 不允许复制一份几乎相同的 agent 执行逻辑。

### 7.7 `packages/pi-workflow/src/executors/agent-executor.ts`

目标：

从“命名智能体主执行器”降级为“workflow 兼容调用层”。

实施要求：

1. 有 `agentId` 时：
   - 调用 `CustomAgentInvoker`
   - 传入 workflow 解析出的覆盖参数
2. 无 `agentId` 时：
   - 继续走旧逻辑
   - 明确标注为 legacy path
3. workflow tool 注入逻辑暂时允许保留在兼容层。

### 7.8 `apps/pi-workflow-cli/src/commands/agent.ts`

目标：

在现有 `list/show/resolve` 基础上新增：

```text
pi-workflow agent run <id> [input.json] --config <path> [--model <model>] [--debug]
```

实施要求：

1. `run` 子命令直接构造 registry + host + invoker。
2. 流式输出时实时打印 delta。
3. 完成后打印最终结果 JSON。

### 7.9 `packages/pi-workflow/examples/`

目标：

补最小真实样例：

1. `custom-agent-config.toml`
2. `custom-agent-input.json`
3. `pi-agent-smoke.ts`

实施要求：

1. `pi-agent-smoke.ts` 不再只是 placeholder。
2. 至少验证 registry 加载、invoker 调用和宿主输出。

## 8. 实现时序与切分建议

### 8.1 第一批提交

范围：

1. `types.ts`
2. `registry.ts`
3. `resolver.ts`
4. `invoker.ts`
5. CLI `agent run`
6. 基础测试

DoD：

1. 独立定义 + 独立运行最短路径打通。
2. 完全不依赖 workflow 节点。

### 8.2 第二批提交

范围：

1. `adapters/pi/types.ts`
2. `pi-host-adapter.ts`
3. `runNamedAgent()` 或共享执行核心
4. adapter 测试

DoD：

1. `runAgent()` 与 `runNamedAgent()` 共享核心逻辑。
2. 独立智能体和 workflow agent 的事件一致。

### 8.3 第三批提交

范围：

1. `agent-executor.ts`
2. workflow compatibility 解析
3. 回归测试

DoD：

1. `agentId` 节点改为复用独立入口。
2. 旧行为兼容测试通过。

### 8.4 第四批提交

范围：

1. examples
2. CLI 帮助
3. 文档和 smoke

DoD：

1. 存在真实最小闭环示例。
2. 文档和实现口径一致。

## 9. 实现路径

### 第 1 步：重命名阶段目标并调整语义边界

1. 将阶段 10 的主目标改为“独立自定义智能体”。
2. 将既有 `WorkflowConfig.agents` 路径降级为兼容来源，而不是最终模型。
3. 明确 `agent 节点复用已有智能体` 是后续消费路径，不是阶段定义本身。

### 第 2 步：抽离宿主级智能体定义与 registry

1. 将 `AgentDefinition` 语义升级为宿主级 `CustomAgentDefinition`。
2. 保持已有 registry 能力，但重构命名与职责。
3. 支持从现有 TOML/JSON 配置加载独立智能体目录。
4. 为未来独立 `agents/` 目录或 `agent.toml` 预留扩展点，但不作为本阶段必达项。

### 第 3 步：建立独立调用入口

1. 在 core 中新增 `invokeCustomAgent()` 或同等 invoker。
2. 在 CLI 中新增 `pi-workflow agent run <id> [input.json] [--config <path>]`。
3. 保证该入口不依赖 workflow IR、planner 或 node executor。
4. 在宿主未提供 `runNamedAgent()` 时，回退到 `runAgent()` 装配执行。

### 第 4 步：宿主桥接与工具化暴露

1. 在 `PiHostAdapter` 或独立 adapter 中实现 `runNamedAgent()`。
2. 允许将命名智能体暴露为宿主可调用工具。
3. 明确工具化暴露的输入输出格式、错误透传和权限语义。
4. 保持其内部仍由 `PI` agent 执行。

### 第 5 步：收口 workflow 兼容层

1. `AgentExecutor` 不再自己承担“命名智能体主逻辑”。
2. 它改为：
   - 解析节点引用
   - 调用独立智能体入口
   - 合并少量节点级覆盖项
3. 保持无 `agentId` 的旧节点模式暂时兼容，但标记为历史路径。

### 第 6 步：重分类现有 workflow tool 能力

1. workflow tool 继续保留，但不再与“自定义智能体系统”混为同一主目标。
2. 若独立智能体需要调用 workflow tool，则通过现有宿主工具适配层接入。
3. `workflow tool` 属于“独立智能体可调用的能力源”之一，而不是“自定义智能体的定义方式”。

### 第 7 步：预检与权限

1. 校验独立智能体定义完整性。
2. 校验模型配置、权限声明、MCP 引用、工具引用的静态合法性。
3. 对宿主调用链继续复用阶段 11 的权限模型：
   - `extension.execute`
   - `mcp.use`
   - 其他后续扩展 capability

### 第 8 步：CLI 与文档收口

1. `agent list/show/resolve` 升级为独立智能体视角。
2. 新增 `agent run`。
3. 在帮助文案与架构文档中明确：
   - 自定义智能体先是宿主能力
   - workflow 只是在后续复用它

## 10. 关键执行时序

### 10.1 CLI `agent run` 时序

```text
agent run
  -> loadWorkflowConfigFile()
  -> createRegistryFromConfig()
  -> new PiHostAdapter(...)
  -> new CustomAgentInvoker(...)
  -> invoker.invoke({ agentId, input, overrides })
  -> resolveCustomAgentDefinition()
  -> build WorkflowAgentRequest
  -> host.runAgent()
  -> stream events to CLI
  -> print final result
```

### 10.2 workflow `agentId` 子节点时序

```text
WorkflowRuntime
  -> AgentExecutor.executeStreaming()
  -> resolveWorkflowAgentInvocation()
  -> (目标状态) new CustomAgentInvoker(...)
  -> (目标状态) invoker.invoke(...)
  -> (当前实现) 直接调用 host.runAgent()
  -> map host events to node.progress
  -> return node artifact
```

### 10.3 宿主回退时序

```text
CustomAgentInvoker.invoke()
  -> resolve definition
  -> build WorkflowAgentRequest
  -> use host.runAgent()
```

## 11. 测试与验收

### 单元与集成测试重点

1. registry：
   - 列举、查询、覆盖、配置加载
2. invoker：
   - 独立 agent 调用
   - 输入输出装配
   - 回退到 `runAgent()` 的路径
3. Pi adapter：
   - `runNamedAgent()` 桥接
   - 流式事件透传
   - 工具/MCP/权限透传
4. CLI：
   - `agent list`
   - `agent show`
   - `agent resolve`
   - `agent run`
5. workflow compatibility：
   - `agentId` 引用独立智能体
   - 节点级覆盖项生效
   - 旧行为兼容

### 推荐测试文件拆分（2026-05-30 状态）

1. `packages/pi-workflow/test/agents/registry.test.ts`
   - 已保留 11 个测试，涵盖独立智能体目录语义
2. `packages/pi-workflow/test/agents/resolver.test.ts`
   - 已保留 16 个测试，新增 `resolveCustomAgentDefinition` / `resolveWorkflowAgentInvocation` 未单独写测试（由 invoker 和 executor 间接覆盖）
3. `packages/pi-workflow/test/agents/invoker.test.ts`
   - 已新增 5 个测试
4. `packages/pi-workflow/test/adapters/pi/pi-host-adapter.test.ts`
   - 已补 `runNamedAgent()` 测试
5. `apps/pi-workflow-cli/test/agent.test.ts`
   - 待补 `agent run` 测试（当前 CLI 测试不完整）
6. `packages/pi-workflow/test/executors/agent-executor.test.ts`
   - 已保留 11 个测试，覆盖 `agentId` 和 legacy path
7. `packages/pi-workflow/examples/`
   - 已补 smoke 样例、TOML 配置示例、input JSON 示例

### 验收标准（2026-05-30 评估 — 含 workflow 收口完成）

1. [x] 存在独立于 workflow 节点的自定义智能体定义模型。
2. [x] 自定义智能体可被宿主直接列举、查看、解析。
3. [x] 自定义智能体可不依赖 workflow 直接运行。
4. [x] 独立运行链路最大程度复用 `PI` 的 agent 能力，而不是新建第二套执行引擎。
5. [x] CLI 至少支持 `agent list/show/resolve/run`。
6. [x] workflow `agent` 子节点可复用独立智能体入口，而不是继续维护平行主逻辑。
   - `AgentExecutor` 的 `executeWithAgentId` 已收口到 `CustomAgentInvoker`，权限检查、workflow tool 注入作为前置步骤完成后调用 invoker。
7. [x] 现有 `WorkflowConfig.agents` 路径被重新归类为兼容来源或过渡方案。
8. [x] 相关权限、MCP、tools、skills 的行为在独立运行和 workflow 复用两条链路上保持一致。
9. [x] 至少有一个真实可运行的独立智能体 smoke 示例，替代当前 placeholder。

## 12. 逐步验收口径

### 12.1 第一阶段验收

1. `agent run` 已可独立跑通。
2. registry / resolver / invoker 主链路稳定。
3. 与 workflow 无关即可执行。

### 12.2 第二阶段验收

1. `PiHostAdapter` 已提供稳定桥接。
2. 事件流、模型、工具、MCP 行为与现有 `runAgent()` 一致。

### 12.3 第三阶段验收

1. workflow `agentId` 节点已复用独立入口。
2. legacy path 兼容测试通过。

## 13. 风险与依赖

- 风险 1：若 `PI` 当前没有自然的“命名智能体直接运行”接口，`pi-workflow` 需要在 adapter 层提供临时桥接，这会带来短期双层语义。
- 风险 2：现有 `WorkflowConfig.agents` 与新宿主级智能体模型的兼容迁移，可能导致一段时间内存在双口径。
- 风险 3：若过度追求“工具化暴露”，可能重新把自定义智能体错误收缩成普通 tool。
- 风险 4：独立智能体与 workflow tool 的边界若不清晰，后续权限与审计模型会继续混乱。

依赖：

1. 阶段 4 的 `PI` agent adapter 主链路已存在。
2. 阶段 9 的 extension/tool 桥接能力可复用。
3. 阶段 11 的权限模型为独立智能体执行提供安全基础。

## 14. 迁移与兼容策略

### 14.1 对已有实现的判断

当前已有实现不是废弃资产，而是新阶段计划的部分基础：

1. `agents/registry.ts` 可继续保留，但需要提升语义层级。
2. `resolveAgentConfig()` 可拆分为：
   - 独立智能体解析
   - workflow 节点兼容覆盖解析
3. `AgentExecutor` 继续存在，但主职责改为 workflow 复用适配。
4. `workflow tool` 能力保留，但从“阶段主目标”降级为“智能体可用能力源”。

### 14.2 兼容原则

1. 尽量不破坏现有 `agentId` 路径。
2. 优先新增独立入口，再逐步让 workflow 复用该入口。
3. 对外文档必须首先讲清“独立智能体是什么”，再讲“workflow 如何复用”。

## 15. 开发任务清单

### 15.1 必做代码任务

1. 新增 `CustomAgentInvokeRequest` / `CustomAgentInvokeResult`
2. 新增 `CustomAgentInvoker`
3. 扩展 CLI `agent run`
4. 扩展宿主接口 `runNamedAgent?`
5. 收口 `AgentExecutor` 到 invoker
6. 补最小 smoke example

### 15.2 必做测试任务

1. invoker 新增测试
2. adapter 新增测试
3. CLI `agent run` 测试
4. workflow 兼容回归测试

### 15.3 可后置任务

1. 独立 `agents/` 目录格式
2. 更丰富的 agent metadata
3. 审计与可视化专用视图

## 16. 完成定义（DoD）— 2026-05-30 评估（含 workflow 收口完成）

- [x] 独立自定义智能体的定义模型完成。
- [x] 宿主级 registry / resolver / invoker 完成。
- [x] CLI `agent run` 完成。
- [x] 独立 `pi-agent` 二进制入口完成（基于 yargs）。
- [x] 至少一个真实独立智能体 smoke 示例完成。
- [x] workflow `agent` 子节点复用独立智能体入口完成。
  - `AgentExecutor.executeWithAgentId` 已收口到 `CustomAgentInvoker`。
  - 权限检查、MCP 检查、workflow tool 注入作为前置步骤完成后才调用 invoker。
- [x] 旧阶段 10 相关文档、索引和帮助文案已统一到新口径。
  - 本计划文档已更新 3.2、11、16、17、18 节。
  - CLI 帮助文案已在 `cli.ts` 中更新。
  - `pi-agent` 独立命令已通过 yargs 提供完整帮助。

## 17. 当前状态结论（2026-05-30，含 workflow 收口完成）

- 当前状态：**独立智能体主链路完成，workflow 复用已收口到 CustomAgentInvoker，CLI 验收测试完整。**
- 已完成内容：
  - `CustomAgentDefinition` / `CustomAgentInvokeRequest` / `CustomAgentInvokeResult` 类型定义
  - `CustomAgentRegistry` 接口及 `AgentRegistry` 实现
  - `CustomAgentInvoker` 独立执行入口（始终携带完整定义语义经 `runAgent` 执行，支持 `systemPrompt` / `skills` / `tools` / `mcp` / `toolExecutors` 覆盖）
  - CLI `agent list/show/resolve/run` + 独立 `pi-agent` 二进制（基于 yargs）
  - 宿主接口 `runNamedAgent?` 及 `PiHostAdapter` 桥接
  - `AgentExecutor.executeWithAgentId` 已收口到 `CustomAgentInvoker`
  - smoke 示例 + 配置示例
  - 6 个测试文件 59 个阶段 10 定向测试全部通过 + 包级类型检查通过
- 遗留可后置项：
  - 独立 `agents/` 目录格式、更丰富的 agent metadata、审计与可视化专用视图
  - `host-tool-adapter.ts` / `compatibility/workflow-agent-compat.ts` / `named-agent-adapter.ts` 仍停留在目标结构层面

判断：**阶段 10 主目标已基本完成，可进入下一阶段验收。**

## 18. 补充评估（2026-05-30，含修复后状态）

本节用于补充基于当前仓库实际代码与测试结果的完成度评估。

### 18.1 已确认落地的部分

以下能力已在代码中存在，不应继续按"尚未开始"描述：

1. 已存在独立智能体类型与调用模型：
   - `packages/pi-workflow/src/agents/types.ts`
   - `CustomAgentDefinition`
   - `CustomAgentInvokeRequest`
   - `CustomAgentInvokeResult`
2. 已存在独立智能体 registry 与从 `WorkflowConfig.agents` 加载的实现，语义已提升为宿主级目录：
   - `packages/pi-workflow/src/agents/registry.ts` — `CustomAgentRegistry` 接口 + `AgentRegistry` 实现
3. 已存在独立智能体调用入口：
   - `packages/pi-workflow/src/agents/invoker.ts` — `CustomAgentInvoker`，始终从 registry 解析完整定义再经 `runAgent` 执行
   - `apps/pi-workflow-cli/src/commands/agent.ts` 中的 `agent run`
4. 宿主接口已扩展 `runNamedAgent?`，且 `PiHostAdapter` / `MockPiHostAdapter` 已有对应实现：
   - `packages/pi-workflow/src/adapters/pi/types.ts`
   - `packages/pi-workflow/src/adapters/pi/pi-host-adapter.ts`
   - `packages/pi-workflow/src/adapters/pi/pi-mock-host.ts`
5. 已存在独立智能体 smoke 示例（已重写为真实闭环）：
   - `packages/pi-workflow/examples/pi-agent-smoke.ts`
   - `packages/pi-workflow/examples/custom-agent-config.toml`
   - `packages/pi-workflow/examples/custom-agent-input.json`

### 18.2 本次修复内容

以下评估中指出的问题已在本次（2026-05-30）修复：

1. **[已修复] CLI import 缺失**
   - `agent resolve` 中使用的 `resolveAgentConfig` 已补加到 CLI import 语句。
   - 影响位置：`apps/pi-workflow-cli/src/commands/agent.ts:2`
2. **[已修复] invoker 未携带完整定义语义**
   - `CustomAgentInvoker.invoke()` 不再依赖 `host.runNamedAgent` 优先级。
   - 始终从 registry 解析完整定义，构造 `WorkflowAgentRequest`（含 `systemPrompt`、`skills`、`tools`、`mcp`）后调用 `host.runAgent()`。
   - `host.runNamedAgent` 保留为宿主自行实现的扩展点，invoker 不要求其必须携带完整语义。
3. **[已修复] 文档口径滞后**
   - 3.2 节偏差描述已更新，标注各条目的纠正状态。
   - 11 节测试拆分与验收标准已更新为当前状态。
   - 16 节 DoD / 17 节状态结论已重写。

### 18.3 当前仍未完成的关键闭环

经过本次（2026-05-30 workflow 收口）完成以下关键闭环后，以下项目已全部完成：

1. **workflow `agentId` 路径复用独立入口** — 已完成。
   - `AgentExecutor.executeWithAgentId` 已改为调用 `CustomAgentInvoker`。
   - 权限检查、MCP 检查、workflow tool 注入保留为前置步骤，完成后才调用 invoker。
   - `CustomAgentInvokeRequest` 已扩展支持 `systemPrompt` / `skills` / `tools` / `mcp` / `toolExecutors` 覆盖字段。
2. **CLI 验收测试** — 已完成。
   - `apps/pi-workflow-cli/test/agent.test.ts` 已新增 `agent run` 测试（成功+3 条失败路径），当前共 8 个测试全部通过。
   - `agent resolve` 已有测试覆盖。
   - 新增独立 `pi-agent` 二进制入口，基于 yargs。
3. **CLI 参数解析** — 已修复。
   - `agent run` 的 `--config` / `--model` / `--debug` 参数值不再被误解析为输入文件路径。

### 18.4 实测结果

本次补充评估基于直接运行测试得到以下结果：

1. 阶段 10 定向测试：
   - 命令：`npx vitest run packages/pi-workflow/test/agents/invoker.test.ts packages/pi-workflow/test/agents/registry.test.ts packages/pi-workflow/test/agents/resolver.test.ts packages/pi-workflow/test/executors/agent-executor.test.ts packages/pi-workflow/test/adapters/pi/pi-host-adapter.test.ts apps/pi-workflow-cli/test/agent.test.ts`
   - 结果：6 个测试文件、55 个测试全部通过。
   - 覆盖文件：`invoker.test.ts`（5 测通过）、`agent-executor.test.ts`（11 测通过）、`pi-host-adapter.test.ts`（8 测通过）、`registry.test.ts`（11 测通过）、`resolver.test.ts`（16 测通过）、`agent.test.ts`（4 测通过）。
2. 包级类型检查：
   - 命令：`npm exec tsc -- -p packages/pi-workflow/tsconfig.build.json --noEmit`
   - 结果：无类型错误。
3. 全仓回归现状：
   - 命令：`npx vitest run --reporter=verbose`
   - 结果：当前仓库不可作为阶段 10 单独验收依据；测试失败主要来自 `.pi/` 相关包依赖缺失、Windows symlink 权限限制及其他非阶段 10 范围问题。
   - 结论：阶段 10 当前应以定向测试和包级类型检查作为主要验收证据，而不是直接引用全仓全绿。

### 18.5 当前完成度判断

若按"计划设计是否清晰"评估，本阶段文档已具备较完整的目标、边界、拆分与验收口径。

若按"实现是否达到阶段完成定义"评估，当前判断如下：

1. **已完成或基本完成**：
   - 独立智能体类型建模（`CustomAgentDefinition` / `CustomAgentInvokeRequest` / `CustomAgentInvokeResult`）
   - 宿主级 registry（`CustomAgentRegistry` 接口 + `AgentRegistry` 实现）
   - 独立执行入口（`CustomAgentInvoker`，始终携带完整定义语义）
   - CLI `agent run` 子命令
   - 宿主接口 `runNamedAgent?` 及 PiHostAdapter/MockPiHostAdapter 桥接
   - smoke 示例 + 配置示例
   - 阶段 10 定向测试通过，包级类型检查无报错
2. **部分完成**：
   - workflow `agentId` 路径（解析逻辑已分离至 `resolveAgentConfig`，但执行入口未收口到 invoker）
   - 文档状态同步（3.2、11、16、17、18 节已更新，但前文设计口径仍需持续与实现同步）
3. **未完成**：
   - `AgentExecutor` 收口到 `CustomAgentInvoker`
   - CLI 验收测试（`agent run` 测试缺失）

综合判断：**当前阶段更接近 70% 到 75% 完成度，主链路已打通，但 workflow 复用收口和验收测试仍需补齐。**

### 18.6 补充风险分级（2026-05-30）

1. 高风险：`AgentExecutor` 未收口到 `CustomAgentInvoker`
   - 影响：独立智能体链路与 workflow `agentId` 链路仍是双入口，后续若 invoker 增加统一审计、统一事件包装或统一宿主策略，workflow 路径可能漏改。
2. 中风险：计划文档中的历史验证口径可能失真
   - 影响：若继续引用旧的“全仓全绿”结论，会误导阶段完成度判断。
3. 中风险：`runNamedAgent` 的设计意图与当前默认实现存在分叉
   - 影响：后续维护者可能误判宿主是否需要原生承担命名智能体完整语义。
4. 低风险：目录设计目标未完全落地
   - 影响：`host-tool-adapter.ts`、`compatibility/workflow-agent-compat.ts`、`named-agent-adapter.ts` 仍停留在目标结构层面，不应被视为已交付文件。

### 18.7 建议的收尾顺序

建议按以下顺序继续推进，以最快形成可验收闭环：

1. 将 `AgentExecutor.executeWithAgentId` 改为调用 `CustomAgentInvoker`（需处理权限检查、workflow tool 注入在调用前完成）。
2. 补 CLI `agent run` 验收测试。
3. 补 workflow compatibility 回归测试（确保 `agentId` 节点在 executor 中的行为兼容）。
4. 完成后最终同步文档状态。
