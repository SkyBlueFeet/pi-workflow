# 阶段 10 专项计划：PI Agent Assembly 装配 DSL 实施收口

> 创建时间：2026-06-09 20:59 +08:00
> 最后更新：2026-06-10 01:13 +08:00
> 当前状态：进行中
> 验收状态：未验收

---

## 1. 背景与目标

> 本文是阶段 10（自定义智能体系统）的专项实施计划，目标不是再定义新语义，而是将 [DESIGN_PI-AGENT-ASSEMBLY.md](../../DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md) 中已经冻结的装配 DSL 定义落到现有实现中。

- 背景：
  当前 [DESIGN_PI-AGENT-ASSEMBLY.md](../../DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md) 已冻结统一装配模型的定义、边界与核心决策，但实现层仍保留旧的 `AgentDefinition / ResolvedAgentConfig / 单 id registry / workflowTools 顶层语义`，且尚未补齐 workflow 对外部 agent 配置文件地址引用的主链路。
- 目标：
  将当前实现收敛到设计文档定义的装配模型，并按功能顺序完成以下能力：
  1. 将当前配置文件中的 `agents.*` 收口为统一 Assembly 输入语义
  2. 让 workflow 内 `agentId` 引用与 CLI `agent run/chat/resolve` 共用同一套装配与解析主链路
  3. 以 PI Agent 外壳与 `pi-tui` 作为默认运行面完成 agent 运行时接入与 TUI 改造
  4. 收口 tools、extensions、MCP、permissions、workflow overlay 等能力的统一装配行为
  5. 将通过显式地址指定外部 agent 配置文件的引用方式作为本阶段预定功能纳入实现范围
- 范围：
  包括类型模型、当前配置文件内 agent 定义索引、resolver、executor、`pi-tui` 运行面接入、TUI 宿主接口、输入归一化与诊断。
- 非目标：
  不在第一轮冻结 PI 原生外部文件格式全部细节；不要求同时交付完整 `pi` / `headless` 双运行面；不要求为旧输入长期维持第二套主语义。

### 1.1 当前已完成内容（截至 2026-06-09）

以下内容已经在当前仓库中完成，可作为本计划的直接基础：

1. 已存在独立 agent 运行骨架：
   - `WorkflowConfig.agents`
   - `AgentRegistry`
   - `resolveAgentConfig()`
   - `CustomAgentInvoker`
   - CLI `agent list/show/resolve/run/chat`
2. 已存在 workflow 侧的 agent 复用链路：
   - `AgentExecutor` 可按 `agentId` 调用命名 agent
   - workflow tool 注入、权限检查、MCP 检查已有基础实现
3. 已存在宿主运行基础：
   - `PiHostAdapter.runAgent()`
   - `runNamedAgent()` 扩展点
   - 阶段 13 已交付的 `read`、`write`、`edit`、`ls`、`grep`、`find` 基础工具

### 1.2 当前未完成的主目标

截至目前，以下关键目标仍未完成，因此本计划仍处于进行中：

1. 尚未形成以 `pi-tui` 为默认运行面的 Assembly DSL 主链路。
2. registry、resolver、executor、backend 仍未统一消费 `ResolvedPiAgentAssembly`。
3. `pi-tui` 宿主接口、运行时事件和默认 coding agent 仍未形成正式交付。

---

## 2. 设计依据

- 上游设计文档：
  [DESIGN_PI-AGENT-ASSEMBLY.md](../../DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md)

- 实施必须遵守的冻结约束：
1. `runtime.mode` 是目标 backend 强约束，不是推荐值。
2. 当前实现中，`agentId` 的定义域是用户显式指定配置文件中的 `agents.*`；外部 agent 地址引用属于本计划预定功能。
3. `workflowTools` 只属于 `workflowOverlay`。
4. `extensions` 只声明来源，`tools` 负责暴露白名单。
5. backend 先产出 `PiRuntimeEvent`，再适配为 `WorkflowHostEvent`。
6. 未显式声明 `runtime.mode` 时，默认目标 backend 为 `pi-tui`。
7. 当前配置文件定义域、`extends` 线性化、legacy `tools` 迁移、结构化诊断、`ResolvedPiAgentAssembly.model` 运行时形态，均以设计文档最新冻结决策为准。

### 2.1 实施硬约束

本计划执行时，必须同时满足以下约束：

1. 阶段 10 的新增实现不得以 `headless` 路径作为默认完成态或验收替代品。
2. 不再允许围绕 `AgentDefinition / ResolvedAgentConfig / 单 id registry` 继续新增主链路功能。
3. 任何“先沿用旧链路、以后再切 TUI”的实现拆分，都不视为本阶段合格交付。
4. PI Agent 原生 `pi-tui` 外壳接入、`PiRuntimeEvent`、workflow 侧宿主/适配接口必须进入主链路；缺一项即不能标记阶段完成。
5. 旧输入只允许做最小归一化，不允许再为旧语义追加长期维护成本。
6. 若某项改动会迫使实现继续依赖 `headless` 事件模型，则该方案应直接判定为不符合本计划。

---

## 3. 最终功能形态

本计划完成后，软件对外应呈现为以下可运行、可观察、可验收的结果，而不只是内部类型重命名或实现收口。

### 3.1 用户可感知功能

本计划完成后，用户侧应首先感知到以下新功能：

1. 可以直接运行一个命名 agent，而不需要先写 workflow 节点。
2. 可以在运行前查看某个 agent 最终会怎样被解释和装配。
3. 可以在 PI 原生 `pi-tui` 交互界面中运行 agent，而不是只得到 `headless` 文本输出。
4. 可以直接获得一个默认可用的 `PI Coding Agent` 配置或模板，而不是从零开始拼装 agent。
5. 可以看到 agent 运行过程中的消息流、工具调用、运行终态与关键诊断，而不是只依赖最终返回值或异常。
6. 在 workflow 中引用某个 agent，与在 CLI 里直接运行这个 agent，表现应保持一致；对于外部 agent 文件引用，workflow 侧应与独立运行保持同一地址指定方式。
7. 当 agent 配置存在冲突、缺失或非法继承时，系统会在运行前给出明确诊断。

### 3.2 你可以直接运行一个 Agent 配置

用户可以通过命令直接运行配置中的某个 agent，而不需要先写 workflow 节点。

示例命令：

```bash
pi-workflow agent run writer --config ./examples/custom-agent-config.toml
```

预期结果：

1. CLI 直接启动 `writer` 这个 agent。
2. 默认进入 `pi-tui` 交互运行面，而不是只输出一个 headless 文本流。
3. 若 agent 配置里带有 skills、tools、mcp、permissions，这些能力按同一装配语义生效。
4. 运行失败时，报错信息直接指向 agent 装配问题，而不是只给出底层执行异常。

### 3.2.1 你可以在 PI 的 TUI 界面中与 Agent 交互

当用户通过 `agent run` 启动一个命名 agent 时，系统应进入 PI 原生 `pi-tui` 交互界面，而不是退化为仅输出纯文本结果的 `headless` CLI。

预期结果：

1. 用户可以直接看到并进入 `pi-tui` 运行界面，而不是只看到一次性标准输出。
2. agent 的消息流、工具调用过程、运行终态和关键诊断，应通过 `pi-tui` 主链路对用户可见。
3. 若宿主能力不足、backend 不可用或 `runtime.mode = "pi-tui"` 无法满足，系统必须在进入运行前明确报错，而不是静默切换到 `headless`。
4. workflow 场景即使不直接承载完整 TUI 外壳，也必须与该 `pi-tui` 运行主链路共享同一套 assembly 解析与 runtime 事实来源。

### 3.2.2 事件改造完成后，用户可以感知到什么

本阶段的事件改造完成后，用户不应只看到“最后输出了什么”，还应能明确感知 agent 在运行过程中发生了什么。

预期结果：

1. 用户可以看到 agent 的文本增量输出，而不是只能等待一次性完整结果。
2. 用户可以看到工具何时开始、何时结束，以及失败是出在模型阶段还是工具阶段。
3. 用户可以看到本次运行是正常完成还是失败结束，而不是依赖异常文本去猜测终态。
4. 当某些 PI 原生运行事件无法完整映射到 workflow 侧事件时，系统至少保留可见诊断，而不是静默丢失。
5. 当前阶段的事件用户可见能力以 `agent run` 的 `pi-tui` 主链路为验收对象，不把“完整 workflow 运行进入 PI TUI 外壳”作为本阶段承诺。

### 3.3 你可以查看一个 Agent 最终会怎样运行

用户可以在运行前查看某个 agent 最终解析后的结果，而不是靠猜。

示例命令：

```bash
pi-workflow agent resolve writer --config ./examples/custom-agent-config.toml
```

预期结果：

1. 输出该 agent 最终生效的 model、prompt、skills、tools、workflowTools、mcp、permissions。
2. 当存在继承、输入归一化、overlay 收口时，输出结果反映的是最终解释后的语义，而不是原始配置文本。
3. 若存在歧义或缺失引用，应在这一阶段就看到诊断，而不是等到真正运行后才发现。

### 3.4 你可以获得一个可直接使用的默认 PI Coding Agent 配置

系统将提供一个开箱即用的默认 `PI Coding Agent` 配置或模板，用于直接进入 `pi-tui` 编码助手运行时，而不是让用户每次都从零拼 agent 字段。

预期交付形态：

1. 提供一个默认配置文件或内置模板，例如 `coding-agent.toml`。
2. 该配置默认具备代码助手所需的基础 system prompt、model、builtin tools、必要 permissions，以及 `pi-tui` 运行模式。
3. 该配置与阶段 13 已接入的 `read`、`write`、`edit`、`ls`、`grep`、`find` 等基础工具能力协同工作。

示例命令：

```bash
pi-workflow agent run coding --config ./examples/coding-agent.toml
```

预期结果：

1. 用户不需要自己先设计一套 agent 结构，就能直接跑一个默认 `pi-tui` 编码助手。
2. 该 agent 能回答代码问题、读取文件、搜索内容，并在权限允许时执行基础文件修改类能力。
3. 后续用户只需要在这个默认配置基础上增删工具、权限和 prompt，而不是每次重建整份 agent。
4. 默认配置的目标能力至少应覆盖：
   - 基础 system prompt
   - 默认 model 配置
   - `read`、`write`、`edit`、`ls`、`grep`、`find` 等内置工具
   - 运行这些工具所需的最小 permissions
   - 可按需继续追加 skills、extensions、mcp

### 3.5 Workflow 中运行的 Agent 和独立运行的 Agent 是同一回事

同一个 agent，被 workflow `agent` 节点引用时，和被 CLI 直接运行时，应使用同一套主语义。

示例场景：

1. `pi-workflow agent run writer --config ...`
2. workflow 节点中 `agentId = "writer"`（当前配置文件内部引用）
3. workflow 节点中显式指定外部 agent 配置文件地址并引用其中某个 agent（待实现）

预期结果：

1. workflow 内部引用与独立运行应共享同一套装配语义。
2. 当前配置文件内部引用与外部 agent 文件地址引用，最终都应收口到同一套解析与执行模型。
3. 差异只允许来自节点级运行时覆盖，而不是来自两套不同的解释逻辑。
4. 用户不需要分别维护“独立 agent 版本”和“workflow agent 版本”。

### 3.6 两类来源的 Agent 可被明确区分与定位

系统将允许两类来源的 agent 定义并存：

1. 当前配置文件内部定义
2. 通过显式地址指定的外部 agent 配置文件

直接表现为：

1. `agentId` 只用于当前配置文件内部定义，不承担外部文件寻址职责。
2. workflow 若引用外部 agent 文件，必须显式给出地址来源，不能仅依赖裸 `agentId`。
3. 继承、查询、解析、执行链路都能准确追踪 agent 的真实来源。

### 3.7 Extension 与 Tool 的关系对用户来说是明确的

用户将能够明确区分“装了哪个 extension”和“暴露了 extension 里的哪些 tool”。

直接表现为：

1. `extensions` 不再等于“自动可调用工具列表”。
2. `tools` 成为明确的暴露白名单，便于审计、调试和权限控制。
3. 工具缺失、引用错误、来源冲突会在运行前被诊断出来，而不是运行过程中隐式失败。

### 3.8 Workflow Overlay 与 Runtime Mode 的行为可预期

用户最终能感知到两件事：

1. `workflowTools`、递归深度等 workflow 专属能力属于 overlay，而不是 agent 本体。
2. `runtime.mode` 是真实 backend 约束，不是模糊建议值。

直接表现为：

1. `workflowOverlay.workflowTools` 成为规范入口。
2. 当前顶层 `workflowTools` 输入会被折叠进 `workflowOverlay.workflowTools`，并产生归一化诊断。
3. 未声明 `runtime.mode` 时默认按 `pi-tui` 运行。
4. 显式要求 `pi-tui` 时，不会被系统静默降级到 `headless` 或其他 backend。
5. `pi-tui` backend 不可用时会在运行前直接报错。

### 3.9 装配错误与诊断更可解释

本计划完成后，系统在 agent 装配相关问题上应能给出更清晰的诊断。

直接表现为：

1. 同名冲突、缺失引用、非法继承、legacy 新旧字段冲突会在规范化或 resolver 阶段被识别。
2. 诊断信息能够说明冲突发生在哪个来源、哪个字段、哪个解析阶段。
3. 用户不需要通过阅读源码才能判断 agent 为什么无法运行。

### 3.10 内部实现新增点

为方便后续 agent 助手核对与测试，本计划完成后，内部实现应至少新增或明确收口以下能力点：

1. 新的装配 DSL 类型：
   - `PiAgentAssemblySpec`
   - `NormalizedPiAgentAssembly`
   - `ResolvedPiAgentAssembly`
   - `ToolExposeRef`
   - `AgentAssemblyDiagnostic`
   - `ResolvedExecutableToolBinding`
2. 当前配置文件中的 `agents.*` 成为装配 DSL 的正式定义载体。
3. 新增或拆分 `normalizeAgentAssembly(rawSpec)` 与 `resolveAgentAssembly(...)`。
4. 节点级 overlay 支持显式 `append` 与 `restrictTo`。
5. `workflowTools` 收口为 `workflowOverlay.workflowTools` 规范语义。
6. `extensions` 与 `tools` 的装配职责分离：
   - `extensions` 负责声明来源
   - `tools` 负责暴露白名单
7. executor / invoker / PI Agent 原生 `pi-tui` 外壳接入层统一消费 `ResolvedPiAgentAssembly`。
8. backend 内部事件改为先产出 `PiRuntimeEvent`，再适配为 `WorkflowHostEvent`。
9. 提供默认 `PI Coding Agent` 配置或模板及其最小示例。
10. 提供 `pi-tui` 宿主接口或适配层，而不是继续把运行面压平到 headless CLI。
11. 所有关键冲突、迁移与引用失败通过结构化诊断对外暴露，而不是裸字符串报错。
12. legacy `tools`、顶层 `temperature/maxTokens`、顶层 `workflowTools` 必须在 normalizer 阶段完成归一化并输出迁移诊断。

---

## 4. 交付范围

- [ ] 定义 `PiAgentAssemblySpec`、`NormalizedPiAgentAssembly`、`ResolvedPiAgentAssembly` 等新模型
- [ ] 定义 `AgentAssemblyDiagnostic`、`ResolvedExecutableToolBinding`、`PiRuntimeEvent` 最小契约
- [ ] 收口当前配置文件内 `agents.*` 到装配 DSL 主链路
- [ ] 增加 workflow 对外部 agent 配置文件地址引用的实现与校验
- [ ] 拆分 normalizer / resolver，完成 overlay 与输入归一化收口
- [ ] 调整 executor / invoker / PI Agent 原生 `pi-tui` 外壳接入边界以消费 `ResolvedPiAgentAssembly`
- [ ] 提供 `pi-tui` 宿主接口与事件适配层
- [ ] 仅保留最小输入归一化，避免继续扩张多套并行主链路
- [ ] 提供一个可直接运行的默认 `PI Coding Agent` 配置或模板
- [ ] 补齐针对新装配模型的测试与验收证据

### 4.1 明确不接受的实现结果

以下结果不计入本计划完成：

1. 只有 `agent run` 的文本流 CLI 运行结果，但没有 `pi-tui` 主链路。
2. 只是新增类型名或适配层包装，但执行仍以旧 `ResolvedAgentConfig` 语义为主。
3. 通过保留大面积旧链路分支来“兼容完成”，而不是把输入收口到新模型。
4. `pi-tui` 不可用时自动走 `headless`，然后将该结果视为阶段验收通过。
5. 诊断仍以裸字符串、零散异常或日志文本为主，而没有统一结构化诊断契约。
6. legacy `tools`、`temperature/maxTokens`、`workflowTools` 仍绕过 normalizer 直接进入 resolver/backend。
7. backend 继续直接输出 `WorkflowHostEvent`，而不是先产出 `PiRuntimeEvent`。
8. 把当前配置文件内部 `agentId` 引用、外部 agent 文件地址引用和未来全局场景混为一谈，导致主链路被过度抽象。

---

## 5. 分阶段任务

> 本节按功能推进顺序组织，而不是按抽象层拆分。所有目标均需要实现，阶段划分只用于表达“先做什么，才能稳定支撑后做什么”。

### Phase 1：统一 Agent 定义入口与可查看结果

- [ ] 在 `packages/pi-workflow/src/agents/types.ts` 中新增装配 DSL 核心类型
- [ ] 新增 `PiAgentAssemblySpec`、`NormalizedPiAgentAssembly`、`ResolvedPiAgentAssembly`
- [ ] 新增 `ToolExposeRef`、`AgentAssemblyDiagnostic`、`ResolvedExecutableToolBinding`、节点级 overlay 类型
- [ ] 在 `toml-section-parsers.ts` 中引入 `workflowOverlay`、`runtime.mode = "pi-tui"` 等规范入口
- [ ] 将当前配置文件中的 `agents.*` 收口为统一 Assembly 输入载体
- [ ] 将 `agents/registry.ts` 收口为当前配置文件装载后的定义索引，并保留 `originPath` 等定位元信息
- [ ] 提供 `get()`、`resolveReference()`、`list()` 等接口
- [ ] 统一 CLI / 诊断输出中的当前生效定义展示规则
- [ ] 让 `agent show` / `agent resolve` 能面向新装配模型输出“最终会怎样运行”的结果，而不是旧片段拼接结果

### Phase 2：统一装配解析与运行前诊断

- [ ] 新增或拆分 `normalizeAgentAssembly(rawSpec)`
- [ ] 新增或重构 `resolveAgentAssembly(...)`
- [ ] 为 `NormalizedPiAgentAssembly` / `ResolvedPiAgentAssembly` 增加结构化 `diagnostics`
- [ ] 收口 `extends`、默认值、现有字段归一化、数组覆盖规则
- [ ] 实现多父 `extends` 线性化顺序、循环继承检测与字段级冲突诊断
- [ ] 将 legacy `tools` 统一映射到显式 `ToolExposeRef`，覆盖 `workflow` / `builtin` / `native` / `extension` / 无 `source` 五种场景
- [ ] 将顶层 `temperature`、`maxTokens` 归一化到 `model.*`，并在冲突时输出迁移诊断
- [ ] 按设计冻结 `ResolvedPiAgentAssembly.model` 的运行时形态，消除顶层 `temperature` / `maxTokens` 与 `model.*` 的双口径
- [ ] 将 legacy 顶层 `workflowTools` 归一化到 `workflowOverlay.workflowTools`
- [ ] 实现节点级 `append` / `restrictTo` overlay
- [ ] 对非法 `id`（包含 `:`）、未解析能力引用、缺失权限元数据等场景提供结构化诊断

### Phase 3：统一 Workflow / CLI / 独立 Agent 共用调用链

- [ ] 让 `executors/agent-executor.ts` 改为消费 `ResolvedPiAgentAssembly`
- [ ] 调整 `agents/invoker.ts` 到装配式调用模型
- [ ] 收束为“当前配置文件 -> agents.* -> agentId 局部引用”的正式主链路
- [ ] 让 workflow 内 `agentId` 引用与 CLI `agent run/chat/resolve` 共用同一套装配与解析结果
- [ ] 统一节点级运行时覆盖的进入点，只允许在 resolved assembly 基础上叠加
- [ ] 明确并固化 workflow 侧与独立运行侧的差异仅来自运行时覆盖，而不是来自两套解释逻辑

### Phase 4：统一 Tool / Extension / MCP / Permission 装配闭环

- [ ] 在 resolver 中产出 `ResolvedExecutableToolBinding` 与各能力的 `requiredPermissions`
- [ ] 收口 `extensions` 与 `tools` 的职责分离：
  - [ ] `extensions` 负责声明来源
  - [ ] `tools` 负责暴露白名单
- [ ] 完成 `workflowOverlay.workflowTools`、全局 `workflowTools` 与运行时工具暴露之间的统一装配规则
- [ ] 在 resolver 中完成 runtime mode 可用性检查与关键诊断
- [ ] 收口 tools、extensions、MCP、permissions、workflow overlay 等能力的统一解析行为
- [ ] 确保能力缺失、权限不足、来源冲突、workflow tool 解析失败都在运行前可被解释和定位

### Phase 5：PI Shell / pi-tui 运行面与 Agent TUI 改造

- [ ] 引入或抽象 `PiAgentBackend`
- [ ] 接入 PI Agent 原生 `pi-tui` 外壳，作为 `pi-tui` 模式的运行面实现
- [ ] 让 executor / invoker / backend 正式消费 `ResolvedPiAgentAssembly`
- [ ] 将 `PiHostAdapter` 的事件压扁职责下沉为 adapter，而不是 backend 上限
- [ ] 定义 `PiRuntimeEvent` 最小事件集合与强制终态事件类型
- [ ] backend 先产出 `PiRuntimeEvent`，再由 adapter 映射为 `WorkflowHostEvent`
- [ ] 对无法无损映射到 `WorkflowHostEvent` 的 runtime 事件保留“未映射”调试诊断
- [ ] 保证 `run_error` / `run_complete` 成为正式终态事件，而不是仅靠异常或返回值表达
- [ ] 明确 workflow 侧仅做事件、权限、工具适配，不承载完整 TUI 外壳
- [ ] 明确本阶段 `pi-tui` 验收对象是独立 agent 运行，不把完整 workflow 运行承载 PI 原生 TUI 外壳作为当前阶段必达项
- [ ] 将 `pi-tui` 运行链路作为默认完成态纳入正式主链路

### Phase 6：默认 Coding Agent、外部引用与验收收尾

- [ ] 提供默认 `PI Coding Agent` 示例配置或模板，并验证 `agent run coding` 的 `pi-tui` 主链路
- [ ] 让默认 Coding Agent 覆盖基础 system prompt、默认 model、内置工具、最小 permissions 与 `pi-tui` 运行模式
- [ ] 设计并实现 workflow 对外部 agent 配置文件地址引用的字段、加载和校验逻辑
- [ ] 将当前配置文件定义域、外部 agent 文件地址引用、多父继承、legacy `tools` 迁移、模型归一化、结构化诊断、runtime 事件映射全部补齐测试
- [ ] 补全类型测试、registry 测试、resolver 测试、executor 回归测试
- [ ] 验证 `agent resolve` 输出最终装配结果与结构化诊断，而不是原始输入片段
- [ ] 只保留最小必要输入归一化，不再为旧路径长期保留并行复杂度
- [ ] 形成最小验收证据与文档同步

---

## 6. 受影响模块

- `packages/pi-workflow/src/agents/types.ts`
- `packages/pi-workflow/src/agents/registry.ts`
- `packages/pi-workflow/src/agents/resolver.ts`
- `packages/pi-workflow/src/agents/invoker.ts`
- `packages/pi-workflow/src/executors/agent-executor.ts`
- `packages/pi-workflow/src/adapters/pi/pi-host-adapter.ts`
- `packages/pi-extension-loader/src/headless-extension-api.ts`
- `packages/pi-workflow/src/config/toml-section-parsers.ts`
- 必要的测试文件与 CLI 适配代码

---

## 7. 风险与依赖

- 风险：
  1. registry、resolver、executor 同时改动，容易造成过渡期双语义并存。
  2. 若 `WorkflowHostEvent` 与 `PiRuntimeEvent` 不解耦，`pi-tui` 主链路会继续被卡死在 headless 事件模型上。
  3. 若继续保留多套旧路径与 `headless` 默认链路，本阶段复杂度会持续失控。
  4. 若“指定配置文件 -> `agents.*` -> `agentId` 局部引用”这条主链路未被清晰收口，类型层收口后仍会在 CLI / resolver / backend 三处重新分叉。
- 依赖：
  1. 以 [DESIGN_PI-AGENT-ASSEMBLY.md](../../DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md) 为唯一设计依据。
  2. 依赖当前阶段 9-13 已有的 extension、tool、permission 基础设施。
- 代码回滚风险（`[!WARNING]`：需回滚的操作/接口标注）：
  1. `AgentDefinition`、`ResolvedAgentConfig`、`workflowTools` 顶层字段若在主链路完成前被半删除，会直接破坏当前调用链。

---

## 8. 完成定义（DoD）

- [ ] 计划目标全部落地
- [ ] 新装配模型已成为主链路内部语义
- [ ] 现有输入已被归一到新语义，且不存在长期并行主链路残留
- [ ] 最终功能形态中的用户可感知行为已成立
- [ ] `agent run <id>` 与默认 `coding` agent 的 `pi-tui` 运行链路可直接演示
- [ ] `pi-tui` backend、事件契约、宿主接口均已进入正式主链路，而非占位
- [ ] `PiRuntimeEvent` 最小事件集、结构化诊断、当前配置文件定义域规则、legacy `tools` 迁移规则均已有实现与测试覆盖
- [ ] `agent resolve` / `agent show` / 运行前检查输出能够展示当前配置文件中的目标定义与结构化诊断
- [ ] 相关质量检查已完成
- [ ] 必要文档与索引已同步
- [ ] 已具备验收条件

---

## 9. 验收结论

- 验收时间：
- 技术栈：
- 目标完成情况：
  - [ ] 目标 1：定义层与实现层完成收口
  - [ ] 目标 2：以 `pi-tui` 为默认运行面的装配 DSL 主链路可运行
  - [ ] 目标 3：最终功能形态中的外部行为与诊断能力已成立
  - [ ] 目标 4：默认 `PI Coding Agent` 配置可直接进入 `pi-tui` 并具备基础代码助手能力
- 非功能检查：
- 最终判定：未验收
- 遗留事项：
