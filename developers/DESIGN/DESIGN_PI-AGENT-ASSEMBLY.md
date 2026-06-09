---
**版本锚点**
- 创建时间：2026-06-09 20:45 +08:00
- 最后更新：2026-06-09 23:45 +08:00
- 最后更新：2026-06-10 00:51 +08:00
- 代码快照日期：2026-06-09
- Git 分支：main
- Git Commit：5366c4e
---

# 设计：将当前 Agent 定义收敛为基于 PI Agent 底座的统一装配模型

## 1. 背景

当前仓库已经具备以下基础能力：

1. `WorkflowConfig.agents` 可声明独立智能体配置。
2. `AgentRegistry`、`resolver`、`CustomAgentInvoker` 可将配置组装为运行请求。
3. `PiHostAdapter` 已直接基于 `@earendil-works/pi-agent-core` 的 `Agent` 执行模型运行。
4. PI 包、skill、prompt、extension、builtin tool、workflow tool 已分别具备部分加载与桥接能力。

但当前体系仍存在一条明显的语义断层：

- 上层仍把 `agents.*` 当作仓库私有的 agent 定义。
- 下层虽然已经复用 PI Agent Core，却没有把上层语义收敛为“基于 PI Agent 底座的统一装配描述”。
- 定义层、解析层、运行层与未来 PI 外壳接入之间因此缺少稳定边界。

本设计的任务，是把这条断层收敛为一套稳定、统一、可扩展的装配语义。

### 1.1 当前已完成的实现基础

当前仓库中已经存在以下可复用基础设施：

1. `WorkflowConfig.agents` 已可声明多个命名 agent 配置。
2. `AgentRegistry`、`resolver`、`CustomAgentInvoker` 已形成 agent 的最小调用闭环。
3. CLI 已提供 `agent list/show/resolve/run/chat` 基础入口。
4. workflow tool、宿主工具适配、权限检查、MCP 检查和阶段 13 的基础工具已可复用。

这些内容说明阶段 10 并非从零开始，但它们并不等于已经完成本文目标。当前真正缺失的是：

1. 尚未形成以 PI Agent 外壳为默认目标的统一装配主链路。
2. 仍以 `AgentDefinition / ResolvedAgentConfig / 单 id registry` 为主语义。
3. backend 与事件契约仍未围绕 PI 上游会话、扩展与包能力完成收口。

## 2. 目标

将当前 `agents.*` 从分散的本地定义收敛为：

**基于 PI Agent 底座的统一装配模型**

即：

1. `agents.*` 可在同一配置文件中定义多个 agent。
2. 同一套定义与实现可在 workflow 内部和外部直接复用，仅使用场景不同。
3. 装配描述可决定模型、prompt、skills、tools、extensions、MCP、权限与运行时特征。
4. 最终运行时统一落到 PI Agent 底座及其外壳、会话、扩展和包体系。

## 3. 非目标

本设计当前阶段不承诺以下事项：

1. 不要求第一轮同时保留多套长期并行的 agent 语义。
2. 不要求所有现有 extension 在第一阶段都获得完整 UI 兼容。
3. 不把 workflow 特有能力直接塞进 PI Agent 本体语义。
4. 不在本文中展开实现步骤、提交顺序和文件级施工安排。

## 4. 术语与边界

### 4.1 PI 本体能力

指应归属于 PI Agent 本身的能力：

1. model
2. prompt
3. skills
4. built-in / native PI tools
5. extensions
6. MCP
7. runtime mode

### 4.2 Workflow Overlay

指只属于 `pi-workflow`，不属于 PI 本体的附加语义：

1. `workflowTools`
2. `maxWorkflowToolDepth`
3. workflow context injection
4. workflow 节点级输入覆盖
5. workflow 运行时控制与权限收窄

### 4.3 Agent Definition Scope

本文中的 agent 指可被 `pi-workflow` 命名、重复引用和独立运行的一类装配定义。当前设计口径下，agent 定义存在两种来源：

1. workflow 当前配置文件内部的 `WorkflowConfig.agents`
2. 通过显式地址指定的外部 agent 配置文件

但需要严格区分“设计目标”与“当前实现状态”：

1. 当前实现已经支持：从当前显式指定配置文件中的 `WorkflowConfig.agents` 取定义。
2. 当前实现尚未支持：workflow 节点通过地址引用外部 agent 配置文件。
3. 外部 agent 地址引用属于阶段 10 的预定功能，应在对应计划中继续跟踪实施，不得在文档中表述为既有事实。

边界冻结如下：

1. `WorkflowConfig.agents` 是当前已实现的主定义入口。
2. workflow 节点中的 `agentId` 仅用于引用当前配置文件内某个已定义的 agent，不产生新的 agent 定义。
3. 若后续支持外部 agent 配置文件引用，则外部来源必须通过显式地址指定，不得与 `agentId` 局部引用混淆。
4. 同一个 workflow 中多次引用同一 `agentId`，属于重复使用同一定义，不构成运行时冲突。

### 4.4 Assembly / Normalized / Resolved

本文中的三层模型含义固定如下：

1. `PiAgentAssemblySpec`：来源相关但语义已统一的装配规格。
2. `NormalizedPiAgentAssembly`：完成默认值、输入归一化、来源标识与继承展开后的规范化模型。
3. `ResolvedPiAgentAssembly`：叠加 workflow overlay、宿主能力与运行时约束后，最终可直接交给 backend 的运行装配。

## 5. 设计原则

### 5.1 PI 本体优先

agent 的核心语义应尽量回归 PI Agent 底座，而不是继续扩张出另一套仓库私有定义。

### 5.2 Overlay 独立

workflow 特有能力应通过 overlay 管理，而不是继续污染 PI Agent 本体语义。

### 5.3 统一标准化模型

当前配置文件中的 `WorkflowConfig.agents` 在进入运行层前，必须先归一化为统一内部模型。

### 5.4 定义层与运行层解耦

定义层只负责描述“如何装配”，运行层只负责消费标准化后的装配结果。

## 6. 已拍板决策

以下内容视为当前版本的冻结决策，后续实现与迁移应以此为准。

### 6.0 实施硬约束

以下约束直接面向实现，不是文档建议：

1. 阶段 10 的新增主链路必须以 PI Agent 外壳为默认运行面推进实现。
2. 不允许继续扩张 `AgentDefinition / ResolvedAgentConfig / 单 id registry` 旧语义。
3. 若某项实现同时服务 workflow 内部和外部调用，必须以统一装配模型为第一优先级。
4. 若 PI Agent 外壳接入、事件契约、workflow 侧宿主/适配接口三者之一缺失，则阶段 10 视为未完成。
5. 现有输入只允许被归一化后进入新模型，不允许继续新增基于旧模型的功能扩展点。

### 6.1 Canonical Schema

1. `model` 是唯一的模型配置块。
2. `temperature` 与 `maxTokens` 仅保留在 `model` 内，不再在 assembly 顶层重复定义。
3. 旧字段可在兼容层继续读取，但规范语义只认 `model`。

### 6.2 Id 与当前引用规则

1. 当前实现中，运行时的已生效定义域是用户显式指定的单个配置文件。
2. 当前实现中，`id` 是该配置文件内 `agents.*` 的定义键，`agentId` 是引用该定义键时使用的字段名；二者不是两套标识体系。
3. 当前实现中，workflow 节点通过 `executor.config.agentId` 引用当前配置文件内的 agent 定义；CLI 独立运行同样依赖当前显式指定的配置文件。
4. 当前实现中，registry 只作为当前配置文件装载后的临时索引，不扩张为全局 agent 中心。
5. `id` 不允许包含 `:`；loader 在读入时必须校验并报错。
6. 设计目标允许后续增加“外部 agent 配置文件地址 + 局部 agent 名”的引用方式，但该能力在当前实现中尚未落地。
7. 与全局列表维护、重复 `id` 策略、隐式多来源查找相关的规则，不在当前阶段主链路中展开。

### 6.3 继承与合并

1. `extends` 采用“父先子后”的顺序。
2. 标量字段由子项覆盖父项。
3. 对象字段默认深合并。
4. 数组字段默认覆盖，不做隐式拼接。
5. 发生循环继承时必须直接报诊断，不允许静默降级。
6. 当前阶段 `extends` 的规范引用格式收束为裸 `id`；继承解析按当前配置文件中的 `id` 查找。
7. `extends` 为数组时，线性化顺序冻结为“按声明顺序从左到右依次合并各父项，再合并当前子项”。
8. 多父冲突时，后声明父项覆盖前声明父项；子项最后覆盖所有父项。
9. `workflowOverlay.workflowTools`、`metadata.extra` 以对象键级别合并；同名键冲突按后者覆盖前者，并输出诊断。
10. `permissions`、`initialMessages`、`skills`、`tools`、`mcp` 均按数组字段规则处理，即默认整体覆盖，不做隐式拼接。

### 6.4 能力装配与工具暴露

1. `extensions` 只表示能力来源，不默认进入 agent 可调用工具集。
2. 只有被显式暴露到 `tools` 的 extension 能力才能被调用。
3. `tools` 必须显式区分来源类型，至少支持 `builtin`、`native`、`extension`、`workflow` 四类。
4. `extension` 类型工具引用必须同时声明 `extension` 与 `name`，用于表达“从哪个 extension 暴露哪个 tool”。
5. 未在 `extensions` 中声明的 extension，不允许仅靠 `tools` 隐式激活。
6. `tools` 的职责是定义“可调用工具暴露白名单”，不是定义“能力来源目录”。
7. normalizer 必须把 legacy `tools` 输入映射为显式 `ToolExposeRef`，不允许把未定型的旧引用直接带入 resolver/backend。
8. legacy 工具迁移规则冻结为：
   - `{ name, source = "workflow" }` -> `{ type: "workflow", name }`
   - `{ name, source = "builtin" }` -> `{ type: "builtin", name, source: "builtin" }`
   - `{ name, source = "native" }` -> `{ type: "native", name, source: "native" }`
   - `{ name, source = "<extensionName>" }` 且 `<extensionName>` 不属于保留来源名时 -> `{ type: "extension", extension: "<extensionName>", name }`
9. legacy `{ name }` 且未声明 `source` 时，兼容层默认按 `{ type: "builtin", name, source: "builtin" }` 处理，并输出迁移诊断，提示用户改为显式 `type`。
10. 保留来源名当前冻结为 `builtin`、`native`、`workflow`；后续新增保留名必须同步更新 normalizer 规则与文档。
11. `ResolvedPiAgentAssembly` 中必须同时包含已解析后的可执行工具绑定，而不只保留 `extensionTools` 一类。

### 6.5 Workflow Overlay 边界

1. `workflowTools` 只属于 workflow overlay，不进入 PI 本体语义。
2. `workflowTools` 的定义来源仅限 `config.workflowTools` 与 assembly 自身的 `workflowOverlay.workflowTools`。
3. `workflowOverlay.workflowTools` 优先于 `config.workflowTools`，同名冲突必须记录诊断。
4. `workflow` 类型的 tool 引用只允许解析到已存在的 workflow tool 定义。
5. workflow tool 缺失、重名或路径失效必须在 resolver 阶段报错。
6. 规范 DSL 只认 `workflowOverlay.workflowTools`。
7. legacy `agents.*.workflowTools` 仅作为兼容输入读取，并规范化映射到 `workflowOverlay.workflowTools`。
8. 当 `workflowOverlay.workflowTools` 与 legacy `workflowTools` 同时存在时，以前者为准，并输出迁移诊断。

### 6.6 Runtime 与 Backend

1. `runtime.mode` 一旦显式声明，即视为强约束目标，不再解释为推荐值。
2. backend 不可用时必须在 resolver 或启动前阶段直接报错，不允许自动 fallback 到其他运行面。
3. 当前阶段的默认验收运行面是 PI Agent 外壳主链路。
4. 运行面的实现目标是接入 PI Agent 外壳与上游会话机制，而不是在 `pi-workflow` 内部重建一套平行运行时。
5. workflow 场景不直接承载完整外壳；其职责是消费 PI 运行时事件并适配为 workflow 可用事件。
6. 若某 backend 或外壳接入缺少其运行面所要求的最小宿主能力，则视为“backend 不可用”，必须在运行前报错。

### 6.7 权限与信任

1. package trust 决定包能不能加载。
2. `permissions` 统一表示 assembly 声明的能力需求。
3. workflow 与宿主只能对 `permissions` 做收窄，不能做提升。
4. 宿主 `permissionCheck` 决定最终能不能执行。
5. 三层判断同时存在时，按“信任 -> 装配 -> 宿主”顺序收口。
6. package trust 是加载前置条件，不参与运行时权限集合计算。
7. 运行时最终权限集合按 `hostAllow ∩ assemblyDeclared ∩ nodeNarrowing ∩ toolRequired` 计算。
8. 任一工具执行前如其 `toolRequired` 超出最终权限集合，必须在执行前报错或触发审批，不允许进入 backend 后再模糊失败。
9. `toolRequired` 不仅适用于 tool 调用，也适用于 extension 激活、MCP 连接及其他需要宿主能力的运行时动作；其来源由各能力解析器在 resolver 阶段显式产出。
10. 若某 skill、extension、mcp 引用缺少可判定的权限需求元数据，则默认按“不可提升权限”原则处理：仅允许在无需新增权限时通过，否则在 resolver 阶段报诊断。

### 6.8 节点级覆盖

1. 节点输入只允许覆盖运行时参数，不允许改写规范化后的 assembly。
2. 允许节点输入覆盖的运行时参数仅限 `systemPrompt`、`prompt`、`model`、`initialMessages`。
3. 节点输入不得新增 `skills`、`tools`、`mcp`、`permissions`、`extensions`。
4. 节点级 `capabilities` 只允许在 assembly 基础上对 `skills`、`tools`、`mcp` 做运行时限制，不得绕过归一化模型。
5. 节点级 overlay 只支持两种显式操作：`append` 与 `restrictTo`。
6. 不支持“删除某个父项”或“按差量补丁隐式修改”的语义。
7. 为保持 canonical schema 单一，节点级 `temperature`、`maxTokens` 不再作为顶层独立覆盖项存在；如需覆盖，必须通过 `model.temperature`、`model.maxTokens` 进入。
8. 节点级模型覆盖优先级冻结为：`nodeInput.model.* > assembly.model.* > workflow 默认模型`。

### 6.9 能力引用与解析顺序

1. `skills`、`tools`、`mcp`、`extensions` 的解析顺序固定为：assembly 先于节点 overlay。
2. 同类能力去重以稳定引用键为准。
3. `skills` 的去重键为 `name + source`，`source` 缺省时统一归一为 `default`。
4. `mcp` 的去重键为 `server`。
5. `tools` 的去重键按类型细化：
   - `builtin/native` 使用 `type + name + source`
   - `extension` 使用 `type + extension + name`
   - `workflow` 使用 `type + name`
6. 同一键发生内容冲突时，节点 overlay 优先，同时必须记录诊断。
7. 未解析到的能力引用必须在运行前报错，不允许把缺失引用带入 backend。

### 6.10 事件契约

1. 事件流基于 PI 上游 session、extension 与 package 能力整合，不在本地重写一套主语义。
2. workflow 侧仅负责将上游运行事件适配为自身可消费事件。
3. 适配层必须保留无法无损表达的原始事件与诊断信息，不得静默丢弃。
4. PI extension 可以参与事件加工、注入、监听与整合，但不改变上游事件作为事实来源的地位。
5. 需要的内部事件对象仅作为适配层产物，不作为对外主契约。

### 6.11 归一化诊断

1. 当前输入进入 normalizer 时必须完成归一化，不允许把旧字段当作最终语义真相。
2. 当新旧字段同时存在且语义冲突时，以新语义为准，并输出诊断。
3. 归一化流程必须直接暴露关键冲突。
4. 对外部协议相关字段与方法，仅保留“按 PI 协议适配”的原则，不在兼容层自行发明新协议。
5. 不扩张多套长期并行主语义。
6. 诊断数据必须结构化输出，不允许只返回裸字符串列表。
7. 统一诊断结构至少包含：`code`、`severity`、`phase`、`message`、`source`、`fieldPath`、`agentId?`。
8. `severity` 冻结为 `error | warning | info`；其中 `error` 必须阻断进入 backend，`warning` 与 `info` 可继续执行但必须对外可见。
9. `phase` 至少区分：`load`、`normalize`、`resolve`、`backend-check`。

## 7. 总体结构

目标结构如下：

```text
Specified Workflow Config File
          ↓
WorkflowConfig.agents
          ↓
Agent Definition Loader
          ↓
PiAgentAssemblySpec
          ↓
Normalizer
          ↓
NormalizedPiAgentAssembly
          ↓
Resolver
          ↓
ResolvedPiAgentAssembly
          ↓
Runtime Backend
  ├── PI Shell
  └── Workflow Runtime Entry
```

对应职责边界如下：

1. loader：只负责把当前配置文件 `WorkflowConfig.agents` 中的定义转成 `PiAgentAssemblySpec`。
2. normalizer：只负责默认值填充、输入归一化、继承展开与诊断。
3. resolver：只负责叠加 workflow overlay、节点级 overlay、权限收窄与 backend 选择约束。
4. backend：只消费 `ResolvedPiAgentAssembly` 并启动对应运行时。

## 8. 数据模型

### 8.1 原始装配规格

建议新增：

```ts
export type ToolExposeRef =
  | { readonly type: "builtin"; readonly name: string; readonly source?: string }
  | { readonly type: "native"; readonly name: string; readonly source?: string }
  | { readonly type: "extension"; readonly extension: string; readonly name: string }
  | { readonly type: "workflow"; readonly name: string };

export interface PiAgentAssemblySpec {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly extends?: readonly string[]; // `id`
  readonly model?: ModelConfig;
  readonly systemPrompt?: string;
  readonly initialMessages?: readonly AgentMessageSpec[];
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly ToolExposeRef[];
  readonly extensions?: readonly PiExtensionRef[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
  readonly permissions?: readonly PermissionGrant[];
  readonly runtime?: {
    readonly mode?: string;
    readonly uiProfile?: string;
  };
  readonly workflowOverlay?: {
    readonly workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
    readonly maxWorkflowToolDepth?: number;
  };
}
```

### 8.2 标准化装配模型

建议新增：

```ts
export interface NormalizedPiAgentAssembly {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly model?: ModelConfig;
  readonly systemPrompt?: string;
  readonly initialMessages?: readonly AgentMessageSpec[];
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly ToolExposeRef[];
  readonly extensions: readonly PiExtensionRef[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
  readonly runtimeMode: string;
  readonly workflowOverlay: {
    readonly workflowTools: Record<string, WorkflowToolDefinition>;
    readonly maxWorkflowToolDepth?: number;
  };
  readonly diagnostics: readonly AgentAssemblyDiagnostic[];
  readonly metadata?: {
    readonly originPath?: string;
    readonly extra?: Record<string, unknown>;
  };
}
```

### 8.3 已解析运行装配

建议新增：

```ts
export interface ResolvedPiAgentAssembly {
  readonly id: string;
  readonly prompt: {
    readonly systemPrompt: string;
    readonly userPrompt?: string;
    readonly initialMessages?: readonly AgentMessageSpec[];
  };
  readonly model?: {
    readonly id?: string;
    readonly temperature?: number;
    readonly maxTokens?: number;
  };
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly ToolExposeRef[];
  readonly executableTools: readonly ResolvedExecutableToolBinding[];
  readonly workflowTools: readonly ResolvedWorkflowTool[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
  readonly permissions: readonly PermissionGrant[];
  readonly runtimeMode: string;
  readonly diagnostics: readonly AgentAssemblyDiagnostic[];
}
```

### 8.4 节点级 Overlay 模型

建议补充：

```ts
export interface CapabilityOverlay<T> {
  readonly append?: readonly T[];
  readonly restrictTo?: readonly string[];
}

export interface AgentNodeCapabilitiesOverlay {
  readonly skills?: CapabilityOverlay<WorkflowSkillRefIR>;
  readonly tools?: CapabilityOverlay<ToolExposeRef>;
  readonly mcp?: CapabilityOverlay<WorkflowMcpConfigIR>;
}

export interface AgentAssemblyDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly phase: "load" | "normalize" | "resolve" | "backend-check";
  readonly message: string;
  readonly source: string;
  readonly fieldPath: string;
  readonly agentId?: string;
}

export interface ResolvedExecutableToolBinding {
  readonly ref: ToolExposeRef;
  readonly record: HostCallableToolRecord | ResolvedWorkflowTool;
  readonly requiredPermissions: readonly PermissionGrant[];
}
```

## 9. 核心契约

### 9.1 Source Loader

```ts
export interface PiAgentSourceLoader {
  loadFromWorkflowConfig(config: WorkflowConfig): readonly PiAgentAssemblySpec[];
}
```

### 9.2 Registry

```ts
export interface PiAgentAssemblyRegistry {
  register(spec: PiAgentAssemblySpec, meta?: AgentAssemblyMeta): string;
  get(id: string): NormalizedPiAgentAssembly | undefined;
  resolveReference(ref: string): NormalizedPiAgentAssembly | undefined;
  list(): readonly NormalizedPiAgentAssembly[];
}
```

### 9.3 Resolver

建议拆成两步：

1. `normalizeAgentAssembly(rawSpec)`：只做定义标准化。
2. `resolveAgentAssembly(node, config, registry, nodeInput)`：把 workflow overlay 与节点级 overlay 应用到标准化装配规格上。

### 9.4 Backend

```ts
export interface PiAgentBackend {
  run(assembly: ResolvedPiAgentAssembly): AsyncGenerator<unknown, WorkflowAgentResult>;
}
```

配套扩展宿主接口建议为：

```ts
export interface TuiAwareExtensionAPI extends PiExtensionHostAPI {
  readonly uiHost: PiTuiHostSurface;
}
```

说明：

1. `PiAgentBackend` 在外壳运行面下可以是对 PI Agent 外壳与会话的接入与适配，而不是仓库内部自建运行时。
2. workflow 侧只负责消费上游运行事件并映射为自身可消费事件，不要求承载完整外壳。

## 10. Legacy 配置映射与规范 DSL

现有 [packages/pi-workflow/src/config/toml-section-parsers.ts](../../packages/pi-workflow/src/config/toml-section-parsers.ts) 中 `agents.*` 是当前阶段的 agent 定义入口，其语义应收敛为基于 PI Agent 底座的统一装配模型。

### 10.1 Legacy 字段映射

| 现有字段 | 规范化后的新语义 |
|---|---|
| `name` / `description` | 装配规格元信息 |
| `systemPrompt` | PI Agent 装配的 system prompt |
| `model` / `temperature` / `maxTokens` | 统一归一化到 `model`；若顶层与 `model.*` 同时存在，以 `model.*` 为准并输出诊断 |
| `skills` | PI skill 引用 |
| `tools` | 兼容旧式 `{ name, source? }`，在 normalizer 阶段映射为显式 `ToolExposeRef` |
| `mcp` | PI MCP 装配项 |
| `permissions` | assembly 声明的能力需求 |
| `workflowTools` | 当前顶层输入写法，归一化后映射到 `workflowOverlay.workflowTools` |

### 10.2 建议增加的规范字段

1. `extensions`
2. `runtime.mode`
3. `runtime.uiProfile`
4. `extends`
5. `workflowOverlay`

### 10.3 规范 TOML 示例

```toml
[agents.writer]
name = "Writer Agent"
description = "PI 原生写作 Agent 的装配描述"
systemPrompt = "You are a professional writer."

[agents.writer.model]
provider = "anthropic"
model = "claude-3-7-sonnet"
temperature = 0.4
maxTokens = 4096

[agents.writer.runtime]
mode = "pi-shell"
uiProfile = "default"

[[agents.writer.skills]]
name = "outline"
source = "@pi/writing"

[[agents.writer.tools]]
type = "builtin"
name = "read"
source = "builtin"

[[agents.writer.tools]]
type = "extension"
extension = "pi-web-access"
name = "search"

[[agents.writer.extensions]]
name = "pi-web-access"

[[agents.writer.mcp]]
server = "ctx7"

[agents.writer.workflowOverlay.workflowTools.review_pr]
workflowPath = "./workflows/review.workflow.json"
```

## 11. 与 PI Agent 定义的关系

本设计不要求当前仓库立即完全复刻 PI 原生 agent 配置格式。

推荐策略：

1. 当前 `agents.*` 保持为仓库自己的 agent 定义入口。
2. 但语义与字段尽量对齐 PI Agent 底座、外壳、会话、extension、package 的内部能力模型。

换言之：

- 不是把当前配置删掉，直接换成另一套全新格式。
- 而是把当前配置升级为基于 PI Agent 底座的统一装配模型。

## 12. 风险

### 风险 1：名义上回归 PI，实际上继续维持自定义运行时

若只改类型名、不改 resolver 与 runtime backend，最终仍是旧语义，收益有限。

### 风险 2：把 workflow overlay 混入 PI 本体

若 `workflowTools`、审批策略、context 注入继续作为 agent 本体字段蔓延，会再次形成语义污染。

### 风险 3：extension / TUI 能力被过早承诺

在 `TuiAwareExtensionAPI` 未落地前，不能宣称所有插件都完整兼容外壳运行面。

### 风险 4：继续维持多套旧路径

若继续把 legacy 语义与旧调用路径都当作当前阶段必保目标，后续实现会长期处于双口径状态，直接抬高主链路复杂度。

## 13. 设计结论

本设计的核心结论是：

1. 当前 `agents.*` 应收敛为基于 PI Agent 底座的统一装配模型。
2. 当前体系不应继续扩展为另一套独立 agent 语义，而应回归 PI Agent 底座语义。
3. `workflowTools`、权限收窄、上下文注入等 workflow 特有能力必须作为 overlay 管理。
4. 必须引入统一标准化模型 `NormalizedPiAgentAssembly`，作为定义层与运行层之间的稳定边界。
5. 后续外壳运行面、PI Agent 定义输入、extension UI 兼容，都应围绕该边界展开，而不是继续在现有定义上叠补丁。

## 14. 相关计划

本文只负责定义、边界与决策；阶段 10 专项计划负责承接实现步骤、文件改造与外部 agent 地址引用等预定功能。

实现步骤、阶段拆分、文件改造范围与验收口径，见：

- [PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md](../PLANS/pi-workflow-phases/PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md)
