---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-27 16:02 +08:00
- 代码快照日期：2026-05-27

---

# Pi Workflow 开发演进路线

> 原位于 `docs/pi-workflow-evolution.md`，按 DOC-RULES 规范移至 `developers/`。

## 1. 演进目标

本路线用于把 `Pi Workflow` 从架构定义推进为可交付的软件能力。开发过程围绕四条主线展开：

1. 定义主线：建立 `pi-native DSL`、`Workflow IR`、schema、loader 和 validator。
2. 运行主线：建立 runtime、planner、scheduler、executor、artifact、event、store 和 resume。
3. 宿主主线：通过 `Pi Host Adapter` 接入 `pi` 的 Agent、Tool、Session、UI 和 package resources。
4. 创作主线：建立 importer、模板、lint/fix、自然语言生成与可视化调试能力。

阶段推进以可运行闭环为核心，每个阶段都需要形成明确产物、测试样例和验收标准。

## 2. 推进原则

### 2.1 用垂直切片推进

每个阶段都交付一条可运行路径，从定义、解析、执行、状态到测试形成闭环。

### 2.2 用 fixture 固化语义

核心语义通过真实 workflow fixture、golden IR、运行结果快照和恢复状态快照固定下来。

### 2.3 用接口稳定边界

DSL、IR、runtime、store、adapter 之间通过显式接口连接，类型定义、事件协议和状态结构随阶段同步固化。

### 2.4 用测试驱动执行正确性

节点排序、ValueRef 解析、artifact merge、frame 递归、pause/resume、event 顺序都需要对应测试覆盖。

### 2.5 用 adapter 承接宿主能力

runtime 通过 `WorkflowHostCapabilities` 使用 `pi` 的 Agent、Tool、Session、UI 和资源能力，adapter 负责宿主事件与 workflow 事件之间的转换。

`WorkflowHostCapabilities` 的最小 contract 需要在确定性 runtime 阶段先固化。阶段 2 只提供事件输出、`NullWorkflowHost` 和 unsupported executor，不定义交互、Agent、Tool 或资源能力；阶段 3 定义 interaction/resume；阶段 4 再接入 PI-backed `runAgent`、`callTool`、资源查询和 session checkpoint。

## 3. 阶段划分

### 阶段 0：基线与工程骨架

目标：

- 建立开发上下文基线。
- 准备 `pi-workflow` 的模块结构、测试入口和示例目录。
- 固化架构文档与演进路线。

工作项：

1. 初始化 `pi-workflow` 与 `AgentTookit-dev` 的 CodeGraph 索引。
3. 建立 `pi-workflow` 工程目录：`dsl`、`ir`、`runtime`、`store`、`executors`、`events`、`host`、`examples`、`test`。
4. 建立测试命令、fixture 目录和示例 workflow 目录。
5. 确认 `./pi-workflow-architecture.md` 与本路线文档版本一致。
6. 完成 PI npm SDK 初步调研，记录 AgentSession、ResourceLoader、package manifest、extension/tool/skill/prompt 发现机制的候选入口。
7. 建立 PI agent mock spike；如果真实 AgentSession 调用缺少凭据或稳定 API，则形成明确 blocked 记录，不阻塞阶段 1-3。

产出：

- CodeGraph 索引与结构索引。
- 工程骨架。
- PI npm SDK 初步调研记录。
- PI agent mock spike 或 blocked 记录。
- 第一批 workflow fixture 占位。

验收标准：

- CodeGraph 索引可用于后续上下文查询；如果当前环境无法初始化，必须记录 blocked 原因和重试命令。
- 工程目录和测试入口可被本地命令识别。
- PI agent mock spike 可运行；真实 AgentSession 闭环可作为阶段 4 准入调研继续推进。

### 阶段 1：pi-native DSL 与 Workflow IR v0

目标：

- 定义第一版 `pi-native DSL`。
- 定义统一 `Workflow IR`。
- 跑通 `DSL -> IR` 转换。

工作项：

1. 定义 DSL 顶层结构：`id`、`version`、`title`、`entry`、`nodes`、`defaults`、`resources`、`settings`。
2. 定义节点结构：`workflow`、`agent`、`manual`、`return`。
3. 定义 `ValueRef`：`run.input`、`context`、`node.output`、`frame.local`、`literal`。
4. 定义 `WorkflowDefinitionIR`、`WorkflowNodeIR`、`WorkflowEdgeIR`、`WorkflowExecutorIR`、`WorkflowOutputBindingIR`。
5. 为 `resources` 和 agent capability 保留扩展占位，PI package、PI prompt、agent skill/tool 引用字段只做透传或 diagnostic，不在本阶段定稿。
6. 实现 DSL loader、schema validator、引用 validator。
7. 实现 `DSL -> IR` mapper。
8. 编写 fixture：最小 return workflow、manual workflow、subworkflow workflow。
9. 编写 golden tests：输入 DSL、输出 IR、诊断信息。

产出：

- `pi-native DSL` v0。
- `Workflow IR` v0。
- `dsl loader`、`validator`、`mapper`。
- golden fixture 与转换测试。

验收标准：

- 至少三个 workflow fixture 能稳定转换为 IR。
- 缺失 entry、重复 node id、无效 ValueRef、无效 dependsOn 能输出诊断。

### 阶段 2：确定性 Runtime MVP

目标：

- 建立 runtime 的最小可执行闭环。
- 支持 root workflow、subworkflow、manual、return。
- 形成执行帧、调度、artifact 和事件的基础语义。
- 固化最小 host contract、event recorder 和 deterministic CLI `run`。

工作项：

1. 定义 `WorkflowRun`、`ExecutionFrame`、`NodeExecutionResult`。
2. 实现 planner：基于 IR 生成节点执行顺序。
3. 实现 scheduler：推进 ready node、completed node、failed node。
4. 实现 frame-manager：创建 root frame 与 child frame。
5. 实现 executor-registry。
6. 实现 `manual` executor。
7. 实现 `workflow` executor。
8. 实现 `return` executor。
9. 实现 `artifact-manager`：写入 shared context、记录 artifacts。
10. 实现 `event-emitter`：输出 workflow、frame、node 事件。
11. 定义最小 `WorkflowHostCapabilities` 与 `NullWorkflowHost`。
12. 实现 event recorder，保留可生成 trace 的原始事件日志。
13. 实现 deterministic CLI `run`。
14. 编写端到端测试：执行 fixture 并断言 final output、shared context、event 顺序。

产出：

- deterministic runtime MVP。
- 执行帧递归模型。
- 基础 artifact merge。
- 基础 runtime event。
- 最小 host contract。
- unsupported executor。
- deterministic CLI `run`。

验收标准：

- root workflow 能完成执行并返回 final output。
- subworkflow 能创建 child frame 并把输出返回父 frame。
- manual 节点输出能合并到 shared context。
- event 顺序可被测试稳定断言。
- unsupported `agent` 节点返回结构化 diagnostic，不阻塞 deterministic runtime。

### 阶段 3：Store、Interaction 与 Resume

目标：

- 建立可中断、可恢复的 workflow run。
- 固化节点边界恢复语义。
- 建立 session checkpoint 与 workflow store 的状态分层。
- 提供 deterministic CLI `resume`。

工作项：

1. 定义 `WorkflowRunState`。
2. 定义 `WorkflowSessionCheckpoint`。
3. 定义 `WorkflowInteraction`。
4. 实现 file-based workflow store。
5. 实现 run state 序列化与反序列化。
6. 实现 `manual` executor 的 await-input 事件。
7. 实现 paused run 保存逻辑。
8. 实现 `resume(workflowRunId, interactionInput)`。
9. 定义节点重入时的输入绑定规则、已完成节点跳过规则和 artifact 保留规则。
10. 实现 deterministic CLI `resume`。
11. 编写 resume 测试：暂停、保存、读取、恢复、完成。

产出：

- workflow store。
- interaction protocol。
- resume protocol。
- pause/resume 测试 fixture。
- deterministic CLI `resume`。

验收标准：

- 节点等待输入时 run state 进入 `paused`。
- store 中保存完整 frame、nodeResults、sharedContext、pendingInteraction。
- 恢复后从当前 frame 的当前节点继续推进。
- 已完成前序节点结果保持稳定。

### 阶段 4：Pi Adapter MVP 与 Agent Executor

目标：

- 将 runtime 接入 `pi` 宿主能力。
- 支持 agent 节点执行。
- 将 workflow 事件输出到 `pi` 可消费的 UI、RPC、日志或 session 记录。

工作项：

1. 基于阶段 0 调研结果确认 PI npm 正式依赖入口。
2. 定稿 `resources.piPackages`、PI prompt、agent skill/tool 引用字段和 package capability catalog。
3. 在阶段 2 最小 host contract 之上定义 `WorkflowPiHostCapabilities` 扩展，补齐 agent、tool、resource 和 session checkpoint 能力；该扩展不替代基础 `WorkflowHostCapabilities`。
4. 实现 `PiWorkflowHostAdapter`。
5. 接入 `AgentSession` 或受控 session 执行模型。
6. 实现 `agent` executor：组装 prompt、输入、上下文摘要和输出 artifact。
7. 接入 agent 可引用的 skill/prompt/tool capability；tool capability 在本阶段只作为 agent 调用上下文或 adapter 内部能力暴露。
8. 按阶段 3 resume contract 接入 session checkpoint 写入与读取，不重定义 resume 语义。
9. 接入 package resources 查询与解析。
10. 实现 runtime event 到宿主 event 的映射。
11. 编写最小端到端示例：DSL workflow 调用 agent 节点并合并结果。
12. 编写 adapter contract tests。

产出：

- `pi host adapter` MVP。
- `agent executor` MVP。
- session checkpoint 接入。
- package resource 解析接入。
- agent workflow 示例。

验收标准：

- workflow 可在 `pi` 宿主中执行 agent 节点。
- agent 节点结果能形成 artifact 并写入 shared context。
- agent 节点可引用第三方 package 提供的 skill/prompt/tool。
- runtime event 能映射到宿主侧事件输出。
- paused checkpoint 能写入并被读取。

### 阶段 5：通用节点扩展

目标：

- 扩展 runtime 的通用编排能力。
- 支持工具调用、HTTP 调用、条件分支、并行分支和循环。

优先节点：

1. `tool`
2. `http`
3. `if`
4. `parallel`
5. `loop`

工作项：

1. 扩展 IR 节点类型。
2. 扩展 DSL schema 与 validator。
3. 先定义 execution policy、超时、重试、取消传播和并发上限的接口边界。
4. 实现 `tool` executor，支持调用阶段 4 capability catalog 中的第三方 package tool。
5. 实现 `http` executor。
6. 实现 `if` composite node。
7. 实现 `parallel` composite node。
8. 实现 `loop` composite node。
9. 扩展 frame 类型：`parallel-branch`、`loop-body`。
10. 编写每类节点的 fixture 与端到端测试。

产出：

- 通用 workflow runtime v1。
- 扩展节点 DSL 与 IR。
- 通用控制流测试集。

验收标准：

- `tool/http/if/parallel/loop` 能被 DSL 表达、转换为 IR 并执行。
- `tool` 节点能调用第三方 package tool。
- 并行分支能独立产生 child frame 并合并结果。
- loop 能基于 ValueRef 数据源迭代执行。
- 超时、重试和取消传播有稳定测试覆盖。

### 阶段 6：Importer 与迁移工具

目标：

- 提供外部 workflow 定义接入能力。
- 建立 `WorkflowDefine` 到 IR 和 DSL 的迁移路径。

工作项：

1. 梳理 `AgentTookit-dev/project/WorkflowDefine` 的 schema 与样例。
2. 定义 `WorkflowDefine -> IR` mapper。
3. 定义 `WorkflowDefine -> pi-native DSL` renderer。
4. 实现 importer diagnostics。
5. 编写最小代表性 WorkflowDefine 迁移 fixture。
6. 编写复杂 WorkflowDefine 诊断 fixture。
7. 编写 importer golden tests。

产出：

- `WorkflowDefine` importer。
- DSL migration renderer。
- importer diagnostics。
- 迁移示例。

验收标准：

- 最小代表性 WorkflowDefine fixture 可转换为 IR。
- 复杂 WorkflowDefine fixture 可输出稳定的部分迁移结果或 unsupported diagnostics，不要求旧 engine/yield/pause-resume 语义完整迁移。
- 迁移后的 DSL 可被 loader 读取并通过 validator。
- importer 诊断能指出无法映射的字段和节点。

### 阶段 7：AI-First Authoring

目标：

- 建立自然语言生成、检查、修复 workflow 的能力。
- 让用户通过目标描述得到可执行 workflow 初稿。

工作项：

1. 实现 `WorkflowDraftGenerator`。
2. 实现 `WorkflowLinter`。
3. 实现 `WorkflowFixer`。
4. 实现 `WorkflowTemplateRegistry`。
5. 实现 `WorkflowRenderer`。
6. 建立 authoring prompt、模板和示例库。
7. 接入 DSL validator 与 runtime dry-run。
8. 编写自然语言到 DSL 的生成评测样例。

产出：

- authoring agent。
- lint/fix 工具链。
- workflow template registry。
- NL-to-DSL 示例与评测。

验收标准：

- 用户输入目标后能生成 DSL 草案。
- 生成结果能通过 validator 或给出可修复诊断。
- fixer 能根据诊断修改 DSL。
- 生成 workflow 能通过 dry-run 或最小执行测试。

### 阶段 8：调试与可视化

目标：

- 提升 workflow 的可观测性、可调试性和协作效率。

工作项：

1. 实现运行 trace 可视化数据模型。
2. 实现节点输入输出查看器。
3. 实现 checkpoint 浏览。
4. 实现 shared context diff。
5. 实现 workflow graph viewer。
6. 接入 runtime event stream。
7. 编写 trace replay 示例。

产出：

- workflow trace viewer。
- context diff viewer。
- checkpoint browser。
- graph viewer。

验收标准：

- 单次 workflow run 可基于阶段 2 event recorder 生成完整 trace。
- 用户能查看节点输入、输出、artifact 和 event。
- checkpoint 可定位到 frame、node 和 pending interaction。

## 4. 关键里程碑

### 里程碑 M1：DSL 与 IR

完成 `pi-native DSL -> IR` 转换。

成功标准：

- 三个 fixture 稳定解析为 IR。
- schema 与引用诊断可测试。

### 里程碑 M2：确定性 Runtime

完成 deterministic runtime MVP。

成功标准：

- root workflow、subworkflow、manual、return 可端到端执行。
- final output、shared context、event 顺序可稳定断言。

### 里程碑 M3：恢复能力

完成 store、interaction 与 resume。

成功标准：

- workflow 可暂停、保存、读取、恢复并完成。

### 里程碑 M4：Pi Adapter

完成 `pi` adapter 与 agent executor MVP。

成功标准：

- workflow 可在 `pi` 宿主中执行 agent 节点并回写 artifact。

### 里程碑 M5：通用节点

完成 `tool/http/if/parallel/loop` 节点扩展。

成功标准：

- 通用编排 fixture 可端到端执行。

### 里程碑 M6：Importer

完成 `WorkflowDefine` importer 与迁移工具。

成功标准：

- `WorkflowDefine` 样例可转换为 IR 和 pi-native DSL。

### 里程碑 M7：Authoring

完成自然语言生成 workflow 草案能力。

成功标准：

- 用户目标描述可生成可校验、可 dry-run 的 workflow 初稿。

当前状态：

- ✅ `WorkflowDraftGenerator`、`WorkflowAuthoringHost`、`RuleBasedWorkflowAuthoringHost` 已实现。
- ✅ lint/fix/template/render/dry-run 与 NL-to-DSL eval runner 已实现并有测试覆盖。
- ⏳ 真实 PI/LLM authoring host 作为后续增强接入同一 contract。

### 里程碑 M8：调试与可视化

完成 workflow run 的 trace、replay、context diff、graph model 与 CLI 调试入口。

成功标准：

- 单次 run 可生成完整 trace。
- 用户可查看节点输入、输出、artifact、checkpoint 与 graph 状态。

当前状态：

- ✅ trace model、replay、context diff、graph model 已实现。
- ✅ runtime event 已补充 timestamp 与节点 runtime detail。
- ✅ CLI `trace` / `inspect` 已支持 trace 输出、节点详情、context diff、graph 和 checkpoint。
- ⏳ Web/TUI viewer 作为后续体验增强，不纳入当前核心验收。

## 4.1 当前实现状态摘要

截至 2026-05-27，阶段 0-11 已完成当前主链路：目录式 DSL、runtime、resume、PI 集成、通用节点、AI-first authoring、trace/inspect、自定义智能体与软件安全策略均已落地。当前剩余工作主要集中在阶段 12 `pwb` bundle 运行态、真实 PI npm SDK / 权限信任源对接、独立 `resources/` 模块，以及 Web/TUI 可视化增强。

## 5. 近期任务清单

当前阶段摘要：

1. 阶段 0-8 的核心演进目标均已落地并完成主链路。
2. 阶段 9 已完成 PI 生态集成初版交付。
3. 阶段 10 已完成自定义智能体系统初版交付。
4. 阶段 11 已完成软件安全策略主链路，包括预检、权限传播、ask_user 授权、审计与 CLI policy。

下一个迭代推进：

1. 实现阶段 12 `pwb` bundle 构建、加载与运行主链路。
2. 将 `run` 默认输入收口到 bundle 运行态，目录输入仅保留 `--dir` 显式入口。
3. 继续对接真实 PI npm SDK 与真实权限/信任源，替换当前宿主回调式桥接。
4. 视需求补齐 `WorkflowDefine -> pi-native DSL` renderer。
5. 继续增强 Web/TUI 可视化与安全决策展示体验。

## 6. 分阶段验收标准

阶段 1 验收：

1. `pi-native DSL` v0 可表达最小 workflow。
2. `Workflow IR` v0 类型稳定。
3. DSL fixture 可转换为 golden IR。
4. validator 能输出结构化诊断。

阶段 2 验收：

1. runtime 可执行 root workflow 与 subworkflow。
2. 支持 `manual/workflow/return`。
3. 支持 artifact merge 与 final output。
4. 支持 workflow、frame、node 事件输出。
5. 支持 deterministic CLI `run`。
6. `agent` 在阶段 4 前返回 unsupported diagnostic。

阶段 3 验收：

1. 支持 paused run。
2. 支持 run state store。
3. 支持 interaction 输入恢复。
4. 支持 host-neutral session checkpoint 索引。
5. 支持 deterministic CLI `resume`。

阶段 4 验收：

1. runtime 接入 `pi` 宿主能力。
2. 支持 agent executor。
3. 支持 agent 引用第三方 skill/prompt/tool capability 与 package resources 查询。
4. 支持 runtime event 映射到宿主侧输出。

阶段 5 验收：

1. 支持 `tool/http/if/parallel/loop`。
2. 支持 `tool` 节点调用第三方 package tool。
3. 支持超时、重试、取消传播。
4. 支持并发上限。
5. 支持通用编排 fixture。

阶段 6 验收：

1. 支持 `WorkflowDefine` importer。
2. 支持迁移为 `pi-native DSL`。
3. 支持 importer diagnostics。

阶段 7 验收：

1. 支持自然语言生成 workflow 草案。
2. 支持 lint/fix。
3. 支持 template registry。
4. 支持 runtime dry-run。

## 7. 演进结论

`Pi Workflow` 的开发路线以可运行闭环推进：

1. 建立 DSL 与 IR。
2. 建立确定性 runtime。
3. 建立 store、interaction 与 resume。
4. 接入 `pi` adapter 与 agent executor。
5. 扩展通用节点。
6. 接入 importer 与迁移工具。
7. 建立 AI-first authoring。
8. 补齐调试与可视化体验。

最终交付形态是一个以执行解释器为核心、以递归编排为运行语义、以 `pi` 宿主能力为能力底座、以 AI 生成与修订为创作入口的任务编排系统。
