# 开发协作文档索引（developers）

> 本文件是 `developers/` 目录索引，面向 AI 与人类开发者。
> 软件使用类文档位于 `docs/`，默认不由 Agent 主动改动。

---

## AI 快速入口

> 当前项目未启用治理配套，按任务直接查阅 developers 根层规范。

| 任务 | 优先阅读 |
|---|---|
| 代码编辑任务（强制遵守语言/场景规范） | [CODE-STYLE.md](./CODE-STYLE.md) + [CODE-STYLES/](./CODE-STYLES/) 对应语言/场景规范 |
| 文档维护 | [DOC-RULES.md](./DOC-RULES.md) |
| token 节省策略 | [AI-CONTEXT-LOADING.md](./AI-CONTEXT-LOADING.md) |

---

## 模块定位

> 当前项目未启用模块业务文件映射表；需要定位代码时，优先使用代码检索工具和项目自身文档。

---

## 技能（Agent 操作手册）

| 文档 | 说明 |
|---|---|
| [SKILLS/README.md](./SKILLS/README.md) | Skill 目录说明与维护约定 |
| [SKILLS/SKILL_ROUTER.md](./SKILLS/SKILL_ROUTER.md) | 统一任务路由与完成后必做规则 |
| [SKILLS/SKILL_CODE_GOVERNANCE.md](./SKILLS/SKILL_CODE_GOVERNANCE.md) | 代码改动治理流程 |
| [SKILLS/SKILL_DOC_GOVERNANCE.md](./SKILLS/SKILL_DOC_GOVERNANCE.md) | 文档改动治理流程 |
| [SKILLS/SKILL_PLAN_INDEX.md](./SKILLS/SKILL_PLAN_INDEX.md) | 计划索引与状态同步流程 |
| [SKILLS/SKILL_CODE_QUALITY_CHECK.md](./SKILLS/SKILL_CODE_QUALITY_CHECK.md) | 质量检查清单与输出要求 |

---

## 规范与治理

| 文档 | 说明 |
|---|---|
| [DOC-RULES.md](./DOC-RULES.md) | 文档维护规则、版本锚点与留痕规范 |
| [CHANGELOG-RULES.md](./CHANGELOG-RULES.md) | CHANGELOG 文档格式、版本管理与维护流程 |
| [CODE-STYLE.md](./CODE-STYLE.md) | 跨语言代码规范总则 |
| [CODE-STYLES/TYPESCRIPT_CODE-STYLE.md](./CODE-STYLES/TYPESCRIPT_CODE-STYLE.md) | TypeScript 规范（按项目启用） |
| [CODE-STYLES/JAVASCRIPT_CODE-STYLE.md](./CODE-STYLES/JAVASCRIPT_CODE-STYLE.md) | JavaScript 规范（按项目启用） |
| [CODE-STYLES/HTML_CODE-STYLE.md](./CODE-STYLES/HTML_CODE-STYLE.md) | HTML 规范（按项目启用） |
| [CODE-STYLES/CSS_CODE-STYLE.md](./CODE-STYLES/CSS_CODE-STYLE.md) | CSS 规范（按项目启用） |
| [AI-CONTEXT-LOADING.md](./AI-CONTEXT-LOADING.md) | AI 按需加载与 token 节省策略 |

---

## 分析与报告

| 文档 | 说明 |
|---|---|
| [DESIGN/README.md](./DESIGN/README.md) | 设计文档目录，收录关键架构与重构方案 |
| [DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md](./DESIGN/DESIGN_PI-AGENT-ASSEMBLY.md) | 将当前自定义 agent 重构为“PI 原生 Agent 装配 DSL”的专题设计 |
| [DESIGN/DESIGN_PI-STUDIO-CONSOLE.md](./DESIGN/DESIGN_PI-STUDIO-CONSOLE.md) | `pi-studio` 宿主级控制台设计，定义产品入口、控制台 shell、`studio-console` 特殊 agent 与 slash command 边界 |
| [PLANS/pi-workflow-phases/PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md](./PLANS/pi-workflow-phases/PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md) | 阶段 10 的专项计划：以 `pi-tui` 为默认运行面的 PI Agent Assembly DSL 实施收口，承接实现步骤、模块改造、外部 agent 地址引用与验收口径 |
| [PLANS/pi-workflow-phases/PLAN_PHASE-10-5_WORKFLOW-TUI-SHELL.md](./PLANS/pi-workflow-phases/PLAN_PHASE-10-5_WORKFLOW-TUI-SHELL.md) | workflow TUI 专项计划：第一阶段观察型 workflow shell 已完成；第二阶段保留为 PI 通用终端框架、workflow 总览 TUI、agent 子视图与输入路由的后续规划 |
| [PLANS/pi-workflow-phases/PLAN_PHASE-15_PI-STUDIO-CONSOLE.md](./PLANS/pi-workflow-phases/PLAN_PHASE-15_PI-STUDIO-CONSOLE.md) | `pi-studio` 控制台专项计划：保留 `pi-workflow`、`pi-agent` 外部命令，新增 `pi-studio --console` 宿主级控制台、catalog 浏览与 AI 创作主链路 |
| [ANALYSIS/README.md](./ANALYSIS/README.md) | 分析文档命名、模板与版本锚点要求 |
| [REPORTS/README.md](./REPORTS/README.md) | 质量报告命名、章节、字段与判定标准 |
| [PLANS/TEMPLATE.md](./PLANS/TEMPLATE.md) | 计划文档模板，预置 DoD 与验收结论章节 |
| [PLANS/PLAN_PI-WORKFLOW-DEVELOPMENT.md](./PLANS/PLAN_PI-WORKFLOW-DEVELOPMENT.md) | Pi Workflow 总开发计划（阶段索引、全局规则、当前状态） |
| [PLANS/pi-workflow-phases/](./PLANS/pi-workflow-phases/) | Pi Workflow 分阶段详细计划（阶段 0-12） |
| [pi-workflow-architecture.md](./pi-workflow-architecture.md) | Pi Workflow 系统架构、核心模型、运行边界 |
| [pi-workflow-evolution.md](./pi-workflow-evolution.md) | Pi Workflow 开发演进路线、阶段划分与里程碑 |
| [pi-workflow-extension-loader-architecture.md](./pi-workflow-extension-loader-architecture.md) | pi-extension-loader 扩展桥接层架构、兼容层与核心数据通道 |

---

## 历史记录（按需查阅）

| 文档 | 说明 |
|---|---|
| [ANALYSIS/](./ANALYSIS/) | 代码与需求分析目录（按主题命名：`ANALYSIS_[主题].md`） |
| [REPORTS/](./REPORTS/) | 代码质量检查报告目录（按时间生成 `CODE_QUALITY_REPORT_*.md`） |
