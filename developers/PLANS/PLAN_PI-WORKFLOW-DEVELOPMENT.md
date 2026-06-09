---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-06-09 22:55 +08:00
- 代码快照日期：2026-05-30

---

# Pi Workflow 总开发计划

> 本文是 `Pi Workflow` 的总开发计划索引，面向开发团队与 AI 协作使用。
> 原位于 `docs/pi-workflow-development-plan.md`，按 DOC-RULES 规范移至 `developers/PLANS/`。

## 1. 文档定位

本文是 `Pi Workflow` 的总开发计划索引，只保留全局目标、阶段边界、推进顺序和跨阶段规则。

各阶段的具体内容已经拆分到 `developers/PLANS/pi-workflow-phases/`：

- 每阶段的最终实现目标。
- 每阶段进入开发前的前置讨论与待确定内容。
- 每阶段当前已进行工作。
- 每阶段目录设计、结构设计、实现路径和验收标准。

配套文档：

- [Pi Workflow 架构设计文档](../pi-workflow-architecture.md)
- [Pi Workflow 开发演进路线](../pi-workflow-evolution.md)
- [阶段计划索引](./pi-workflow-phases/README.md)

## 2. 总体目标

`Pi Workflow` 的目标是在当前仓库中实现一个独立 npm 工程，以 PI 作为外部 npm 能力基座，提供可运行、可恢复、可递归、可扩展、可组合的 workflow runtime。

最终交付形态：

1. `@pi-workflow/core`：DSL、IR、runtime、store、executor、event、host contract。
2. `@pi-workflow/core/adapters/pi`：通过 PI npm 包接入 Agent、Tool、Session、Resource 与第三方 PI package 能力。
3. `pi-workflow` CLI：运行、恢复、检查和调试 workflow。
4. `pi-native DSL`：主 workflow 定义格式。
5. `WorkflowDefine importer`：外部定义迁移入口。
6. `AI-first authoring`：自然语言生成、检查和修复 workflow 草案。

## 3. 工程落点

目标工程结构：

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
      resources/
    test/
    examples/
apps/
  pi-workflow-cli/
```

PI 接入原则：

1. PI 作为外部 npm 依赖和能力基座。
2. `src/adapters/pi` 是本项目正式适配层。
3. 阶段 1 只为 `resources` 保留扩展入口；`resources.piPackages` 的正式结构在阶段 4 定稿。
4. PI adapter 负责发现 package manifest、extensions、skills、prompts、tools，并生成 workflow capability catalog。
5. runtime 只依赖基础 `WorkflowHostCapabilities`，不直接绑定具体 PI 实现细节；PI adapter 通过 `WorkflowPiHostCapabilities` 扩展接入 Agent、Tool、Resource 与 session checkpoint 能力。

## 4. 阶段索引

| 阶段 | 阶段文件 | 阶段主目标 |
|---|---|---|
| 阶段 0 | [基线与工程骨架](./pi-workflow-phases/PLAN_PHASE-0_BASELINE-AND-SKELETON.md) | 建立独立 npm 工程、核心包、CLI 入口、PI npm adapter 模块入口、CodeGraph 索引、PI npm SDK 调研与 agent mock spike |
| 阶段 1 | [pi-native DSL 与 Workflow IR v0](./pi-workflow-phases/PLAN_PHASE-1_DSL-AND-IR.md) | 定义 DSL、IR、ValueRef、validator、mapper 和 golden fixtures |
| 阶段 2 | [确定性 Runtime MVP](./pi-workflow-phases/PLAN_PHASE-2_RUNTIME-MVP.md) | 跑通 manual/workflow/return 的确定性执行闭环，固化最小 host contract、event recorder 和 deterministic CLI run |
| 阶段 3 | [Store、Interaction 与 Resume](./pi-workflow-phases/PLAN_PHASE-3_STORE-INTERACTION-RESUME.md) | 支持暂停、保存、读取、恢复、节点边界重入和 deterministic CLI resume |
| 阶段 4 | [PI npm Adapter MVP 与 Agent Executor](./pi-workflow-phases/PLAN_PHASE-4_PI-NPM-ADAPTER-AGENT.md) | 接入 PI npm 能力、Agent executor、PI package capability catalog，并支持 agent 节点引用第三方 skill/prompt/tool |
| 阶段 5 | [通用节点扩展](./pi-workflow-phases/PLAN_PHASE-5_GENERAL-NODES.md) | 支持 tool/http/if/parallel/loop、tool 节点调用第三方 tool 和执行策略 |
| 阶段 6 | [目录加载器与文件化 DSL](./pi-workflow-phases/PLAN_PHASE-6_WORKFLOWDEFINE-IMPORTER.md) | 固化目录式新格式导入：`flow.json` / `nodeFiles` / `promptFile` / 嵌套子工作流 |
| 阶段 7 | [AI-First Authoring](./pi-workflow-phases/PLAN_PHASE-7_AI-FIRST-AUTHORING.md) | 支持自然语言生成、lint、fix、template 和 dry-run |
| 阶段 8 | [调试与可视化](./pi-workflow-phases/PLAN_PHASE-8_DEBUG-AND-VISUALIZATION.md) | 支持 trace、replay、context diff、graph model 和 CLI/SDK 调试入口 |
| 阶段 9 | [PI 生态集成](./pi-workflow-phases/PLAN_PHASE-9_PI-ECOSYSTEM-INTEGRATION.md) | TOML 配置、PI 包管理器、资源加载、基于 PI 的 extension 桥接、信任模型 |
| 阶段 10 | [自定义智能体系统](./pi-workflow-phases/PLAN_PHASE-10_CUSTOM-AGENT-SYSTEM.md) | 基于 PI 的独立自定义智能体、宿主级运行入口、workflow 复用适配 |
| 阶段 11 | [软件安全策略](./pi-workflow-phases/PLAN_PHASE-11_SOFTWARE-SECURITY-POLICY.md) | 权限模型、预检、降权传播、审计、PI 生态安全适配 |
| 阶段 12 | [PWB Bundle 运行态](./pi-workflow-phases/PLAN_PHASE-12_PWB-BUNDLE-RUNTIME.md) | 建立目录作者态到 `pwb` 运行态的 bundle 构建、加载与运行主链路 |
| 阶段 13 | [PI 宿主工具与基础工具迁移](./pi-workflow-phases/PLAN_PHASE-13_PI-HOST-TOOLS-AND-FILE-CAPABILITIES.md) ✅ | 打通 `callTool()`、迁入无头 `read/write/edit/ls/grep/find`，建立 workflow `tool` 节点与宿主基础工具闭环 |

## 5. 阶段准入规则

每个阶段进入实现前，先完成该阶段文件的第二节：`前置讨论与待确定`。

准入要求：

1. 第二节中的问题已讨论并形成结论。
2. 结论已回写到该阶段文件的结构设计或实现路径。
3. 该阶段的测试与验收标准已明确。
4. 若结论影响架构或阶段边界，同步更新架构文档或演进路线。

若历史记录、开发日志或旧版本计划与当前文档存在歧义，以本文、架构设计文档和对应阶段计划文件为准。

### 5.1 计划审查口径

1. 只有当前置阶段的验收依赖后置阶段实现、前置接口把后置能力设为必选、后置阶段无法在不重写前置核心的情况下接入、同一能力在多个阶段被列为不同语义的必达项、阶段输入产物只能由后续阶段产生且没有 mock/占位替代，或关键调研被放在依赖它的定稿设计之后且没有 blocked/返工机制时，才判定为开发顺序问题。
2. 前期允许提前定义后续阶段需要的类型、字段、目录、节点 kind、metadata、optional capability、unsupported diagnostic、mock/null adapter 和架构目标；这些内容只要不进入当前阶段验收、不被写成必选运行能力，就属于可演进设计，不作为开发顺序问题。
3. 后续阶段允许扩展、细化或调整前期草案；审查重点是是否阻塞当前阶段交付，以及是否会迫使后续阶段推翻前期核心模型。

## 6. 阶段完成规则

每个阶段完成时，需要满足：

1. 阶段文件中的验收标准全部通过。
2. 对应 fixture 和 tests 已补齐。
3. 当前已进行工作一节已更新。
4. 需要保留的实现约束已写入阶段文件。
5. 根据 LogSync 规范更新当天 `docs/dev-note_YY-MM-DD.md`。

## 7. 完成定义（DoD）

总项目完成定义：

- [x] 阶段 0-8 核心验收标准全部通过。
- [x] 阶段 9 PI 生态集成（TOML 配置、包管理器、资源加载、基于 PI 的 extension 桥接、信任模型）— 初版交付通过。
- [ ] 阶段 10 自定义智能体系统（基于 PI 的独立自定义智能体、宿主级运行入口、workflow 复用适配）。
- [x] 阶段 11 软件安全策略（权限模型、预检、降权传播、审计、PI 生态安全适配）。
- [x] 阶段 12 PWB Bundle 运行态（bundle 构建、加载、资源归档、CLI 运行主链路）。
- [x] 阶段 13 PI 宿主工具与基础工具迁移（`callTool()`、无头基础工具、`tool` 节点宿主闭环）。
- [x] 最终交付形态（`@pi-workflow/core`、CLI、pi-native DSL、importer、AI-first authoring）全部可用。
- [ ] 跨阶段接口（DSL/IR、host contract、store 协议）均稳定且无破坏性变更。
- [ ] 必要文档与索引已同步。

单阶段完成定义见各阶段文件的第 7 节。

## 8. 风险与依赖

- **风险 1：PI npm SDK API 不稳定** — 阶段 0 调研时若 API 缺失或文档不足，记录 blocked，不阻塞阶段 1-3 的确定性实现。
- **风险 2：真实 AgentSession 闭环依赖凭据/环境** — 阶段 0 mock spike 作为降级方案，真实闭环推迟到阶段 4 验前补齐。
- **风险 3：DSL/IR 超前定义与确定性 runtime 脱节** — 阶段 1 定义的 agent 节点类型允许透传与 diagnostic，不要求阶段 2 执行；阶段 4 再对接 PI-backed executor。
- **依赖 1：阶段 2 host contract** — 阶段 3 resume、阶段 4 PI adapter 均依赖阶段 2 的最小 `WorkflowHostCapabilities` 稳定。
- **依赖 2：阶段 3 resume contract** — 阶段 4 session checkpoint 接入依赖阶段 3 的 resume 语义与 store 协议。

## 9. 当前状态

已完成文档工作：

1. 架构文档已建立：[pi-workflow-architecture.md](../pi-workflow-architecture.md)。
2. 演进路线已建立：[pi-workflow-evolution.md](../pi-workflow-evolution.md)。
3. 总开发计划已拆为总览索引与阶段文件。
4. 阶段 0-12 独立计划文件已建立。
5. PI 生态能力包接入模型已进入阶段 4 adapter contract 与 mock 实现；真实 PI npm SDK 接入仍受私有包可用性限制。

已完成的阶段 0 工作：

1. CodeGraph 索引已初始化并运行（当前 TypeScript 索引：121 files / 884 nodes / 971 edges）。
2. PI npm SDK 初步调研记录：[PI_NPM_SDK_RESEARCH.md](../ANALYSIS/PI_NPM_SDK_RESEARCH.md)（BLOCKED — 内部私有包，公共 registry 无目标包）。
3. PI AgentSession mock spike 占位已建立：`packages/pi-workflow/examples/pi-agent-smoke.ts`。真实闭环待阶段 4 接入。
4. 阶段 0 工程骨架已实现：
   - 根 npm workspace（`packages/pi-workflow` + `apps/pi-workflow-cli`）
   - `@pi-workflow/core` 核心包：11 个模块空入口 + adapter 模块入口 + fixture 目录
   - `pi-workflow-cli` CLI 入口
   - TypeScript build + Vitest 测试通过

已完成阶段 1-8：

1. ✅ 阶段 1（DSL/IR v0）：类型定义 + loader + validator + mapper + golden fixtures + 测试通过
2. ✅ 阶段 2（Runtime MVP）：WorkflowRuntime + planner + executor-registry + 三类 executor + artifact + event + host + CLI run + 测试通过
3. ✅ 阶段 3（Store/Interaction/Resume）：MemoryStore + FileStore + pause/resume + CLI resume + 测试通过
4. ✅ 阶段 4（PI Adapter）：PiHostAdapter + PiCapabilityCatalog + PiEventMapper + AgentExecutor + mock + 测试通过
5. ✅ 阶段 5（通用节点扩展）：tool / http / if / parallel / loop executor + cancellation / timeout / retry / concurrency policy 模块 + runtime composite 扩展 + 测试通过（55 tests）
6. ✅ 阶段 6（目录加载器与文件化 DSL）：目录式 `flow.json` / `nodeFiles` / `promptFile` / `subWorkflowDir` / `$schema` 集成 + CLI 装配完成
7. ✅ 阶段 7（AI-First Authoring）：draft generator、rule-based authoring host、linter、fixer、template registry、renderer、dry-run、NL-to-DSL eval runner 完成
8. ✅ 阶段 8（调试与可视化）：trace、replay、context diff、graph model、checkpoint inspect、node runtime detail、CLI `trace` / `inspect` 完成

当前遗留事项：

1. 真实 PI npm SDK / AgentSession 入口仍受私有包可用性限制，当前以 mock/adapter contract 闭环为准。
2. `resources/` 独立资源模块、PI package resolver/resource bridge 仍待真实 SDK 入口稳定后细化。
3. `WorkflowDefine -> pi-native DSL` renderer 与旧格式迁移命令未作为当前阶段必达项完成。
4. Web/TUI 可视化未实现，当前阶段 8 以 SDK model + CLI 调试入口作为验收边界。
5. ✅ 阶段 9 PI 生态集成已完成初版交付：包括 TOML 配置、PI 包管理器(stub)、资源加载、基于 PI 的 extension 桥接(stub)与信任模型。
6. 阶段 10 已有部分实现：当前已落地 workflow 内命名 agent 配置、workflow tool、递归控制与 CLI agent，但阶段目标已按“独立自定义智能体”新口径重写，尚未完成宿主级独立运行入口与 workflow 复用收口。
   - 相关定义文档：`developers/DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md`
   - 相关专项计划：`developers/PLANS/pi-workflow-phases/PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md`
7. ✅ 阶段 11 软件安全策略主链路已完成：包括统一权限模型、静态预检、运行时拒绝、ask_user 授权、审计记录、CLI `policy` 和 `trace` / `inspect` 安全决策展示。
8. ✅ 阶段 12 PWB Bundle 运行态主链路已完成：包括 `pwb` zip 构建/加载、`inline`/`archive` 资源分类归档、强制哈希与大小校验、CLI `build`/`run`/`inspect` 命令、临时 bundle 自动清理，以及 build/load/run/inspect 四类测试矩阵。
9. Config 模块的前置工作已完成（ModelConfig、WorkflowConfig、层级解析、预运行校验），作为阶段 9-12 的配置基础。
10. ✅ 阶段 13 PI 宿主工具与基础工具迁移已完成：包括 `PiHostAdapter.callTool()` 实现、`read/write/edit/ls/grep/find` 六个无头基础工具迁入、`register.ts` 统一注册入口、CLI 装配、权限接入、`ToolExecutor` 宿主回退链路闭环、新增 11 个测试项和 6 个 workflow fixture。
11. 全部阶段 0-13 主链路已完成。后续可继续补更多专用端到端测试与真实 PI 宿主对接，但不影响当前已完成阶段主链路状态。

阶段 6 当前状态：

1. ✅ 目录加载器主链路已完成：`flow.json` / `nodeFiles` / `promptFile` / 复杂节点目录 / `subWorkflowDir` 递归展开均已实现并通过测试。
2. ✅ 当前口径已明确：新 workflow 定义以目录式结构为准，导入能力目前只支持目录式入口。
3. ✅ CLI `run` / `trace` / `inspect` 已支持目录式 workflow；`$schema` 校验已集成。
4. ⏳ 单文件导入导出继续作为后续按需设计项，不计入阶段 6 当前验收。

## 10. 推进顺序

按阶段准入分批推进，从阶段 0 开始：

1. 阶段 0：补齐基线、工程骨架与 PI SDK 初步调研；PI agent 只要求 mock spike 或 blocked 记录，不等待真实 PI 调用闭环。
2. 阶段 1：定义 DSL/IR v0，可定义 `agent` 等未来节点类型；PI package、PI prompt、agent skill/tool 引用只保留扩展占位或 diagnostic，不在本阶段定稿。
3. 阶段 2：实现确定性 runtime MVP、最小事件型 `WorkflowHostCapabilities`、`NullWorkflowHost`、unsupported executor、event recorder 和 deterministic CLI `run`。
4. 阶段 3：实现 store、interaction、host-neutral checkpoint、resume 和 deterministic CLI `resume`。

阶段 4 在阶段 0 的 PI npm SDK 初步调研、阶段 2 host contract 和阶段 3 resume contract 完成后再进入详细实现。阶段 4 负责定稿 `resources.piPackages`、PI prompt、agent skill/tool 引用字段，解除 `agent` 节点的 PI-backed 执行能力，并允许 agent 节点引用第三方 skill/prompt/tool；第三方 tool capability 在阶段 4 只作为 agent 调用上下文或 adapter 内部能力暴露，正式 workflow `tool` 节点执行能力进入阶段 5。PI session checkpoint 的具体映射、PI package source、第三方 package 使用策略和 trust policy 推迟到阶段 4 开发前确认，不阻塞阶段 0-3。

阶段 5 实现通用节点前，先固化 execution policy、timeout、retry、cancel 与 concurrency 的接口边界，再装配 `tool/http/if/parallel/loop` executor。

阶段 6 以目录式新格式导入为正式目标；`flow.json`、`nodeFiles`、`promptFile` 和嵌套子工作流是当前必达项。单文件导入导出与其他历史格式迁移不作为当前阶段必达目标，后续按真实需求单独设计。

阶段 9 在阶段 0-8 核心工程完成后进入。前置条件：Config 模块（ModelConfig、WorkflowConfig、层级解析、预运行校验）已完成并合并到主分支。阶段 9 按“配置加载 -> 包管理 -> 资源加载 -> extension 桥接 -> 预检与 CLI”顺序推进，并明确第三方包问题以 PI 内部处理结果为准，workflow 侧只承担防御性检测、桥接装配与错误透传。

阶段 10 在阶段 9 的资源加载与工具桥接主链路稳定后进入。阶段 10 当前的主目标已经明确为“以 `pi-tui` 为默认运行面的 PI Agent Assembly DSL 收口”，推进顺序为“Assembly DSL 定义 -> 多来源 registry -> normalizer / resolver -> `pi-tui` backend / host surface -> 默认 coding agent -> workflow 复用 -> 外部 agent 地址引用”。

阶段 11 在阶段 9-10 的包桥接、智能体与 workflow tool 主链路稳定后进入。阶段 11 按“权限面盘点 -> 安全配置 -> 权限解析 -> 运行前预检 -> 执行链路接入 -> 审计与 PI 生态适配”顺序推进，原则上优先复用 PI 生态内已验证能力，只补 workflow 语义层的权限治理缺口。

阶段 12 在阶段 11 的安全边界基本稳定后进入。阶段 12 按“bundle 类型与校验 -> 目录构建 bundle -> 资源归档 -> bundle 运行入口 -> CLI 收口与兼容策略”顺序推进，明确目录只作为作者态输入，运行时以 `pwb` 为主。

阶段 13 在阶段 9.5 的工具桥接、阶段 11 的权限模型和阶段 12 的运行主链路稳定后进入。阶段 13 按“宿主 `callTool()` -> built-in 基础工具迁入 -> 权限接入 -> workflow fixture 验证”顺序推进，目标是把 PI 宿主工具能力从接口占位推进为 workflow 可直接消费的正式能力。该阶段已于 2026-05-30 完成。

## 11. 验收结论

- 验收时间：2026-05-30（阶段 13 已验收）
- 技术栈：TypeScript、Node.js workspace、Vitest、CLI
- 目标完成情况：阶段 0-13 全部主链路已完成。`@pi-workflow/core` 与 CLI 已覆盖 workflow `tool` 节点对 PI 宿主基础工具的直接消费。
- 非功能检查：最近一轮相关构建与测试已在开发日志中记录通过；CodeGraph 当前仅索引 TypeScript，文档变更后无需同步代码索引但代码变更后需 `codegraph sync`。
- 最终判定（当前）：阶段 0-13 主链路全部已完成。
- 阶段 9 状态：初版交付已通过。
- 阶段 10 状态：当前已完成独立 agent、CLI、invoker、workflow 兼容等基础设施；但以 `pi-tui` 为默认运行面的 Assembly DSL 主目标尚未完成，且外部 agent 地址引用仍在实施收口中。
- 阶段 11 状态：主链路已完成，后续可继续细化权限 scope、真实 PI 权限桥接与可视化表现。
- 阶段 12 状态：主链路已完成。包含 zip `pwb` 构建/加载、独立 `resources/` 模块、`inline` 资源内联到 document、`archive` 资源 zip 归档、强制哈希与大小校验、CLI `build`/`run`/`inspect` 命令、临时 bundle 自动清理，以及 build/load/run/inspect 四类测试矩阵。
- 阶段 13 状态：✅ 已完成。`PiHostAdapter.callTool()` 已实现（工具注册表/查找/权限/执行），六个无头基础工具已迁入，权限检查已接入，`ToolExecutor` 宿主回退闭环已形成并通过测试。
- 遗留事项：真实 PI npm SDK、WorkflowDefine DSL renderer、Web/TUI viewer。

## 12. 计划维护规则

1. 总计划只维护阶段索引、全局规则和当前总状态。
2. 阶段细节只写入 `developers/PLANS/pi-workflow-phases/PLAN_PHASE-*.md`。
3. 待确定内容写入对应阶段文件第二节。
4. 已确定内容回写到对应阶段文件的结构设计、实现路径和验收标准。
5. 已完成工作写入对应阶段文件第三节。
6. 开发日志写入 `docs/dev-note_YY-MM-DD.md`。
