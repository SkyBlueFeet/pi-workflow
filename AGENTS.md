# Repository Guidelines

## 项目定位

本文件用于指导AI Agent工具在本仓库中的协作方式。

核心目标：
- 快速定位模块、业务与代码文件
- 让 AI 与开发者在最小上下文下高效协作
- 维持代码质量、可维护性、可扩展性
- 用按需加载控制 token 成本

---

## 文档分层

- `developers/`：面向 AI 与人类开发者的规范、技能、分析、报告、留痕。
- `docs/`：面向软件使用者的文档。
- 未特别说明时，Agent 不主动改动 `docs/`。

---

## 任务入口

> 当前项目未启用治理配套，按任务直接查阅 developers 根层规范。

### 快速路由

| 当前情形 | 立即查阅 |
|---|---|
| 浏览开发文档目录 | `developers/INDEX.md` |
| 控制上下文读取与 token 成本 | `developers/AI-CONTEXT-LOADING.md` |
| 代码编辑任务（强制遵守语言/场景规范） | `developers/CODE-STYLE.md` + `developers/CODE-STYLES/` 对应语言/场景规范 |
| 新建或修改文档 | `developers/DOC-RULES.md` |
| 配置系统（ModelConfig / WorkflowConfig / 预检） | `packages/pi-workflow/src/config/` |
| PI 生态集成（TOML 配置 / PI 包 / skill / extension） | `developers/PLANS/pi-workflow-phases/PLAN_PHASE-9_PI-ECOSYSTEM-INTEGRATION.md` |

---

## 文档读取策略

启动时必读：
- `AGENTS.md`（本文件）

按任务按需读取：
- `developers/INDEX.md`
- `developers/DOC-RULES.md`
- `developers/CODE-STYLE.md`
- 对应语言/场景规范：`developers/CODE-STYLES/*_CODE-STYLE.md`
- `developers/AI-CONTEXT-LOADING.md`

历史按需读取：
- `developers/ANALYSIS/`
- `developers/REPORTS/`

---

## 通用原则

- **兼容优先**：对外接口变更必须版本化或提供兼容迁移路径。
- **注释有约束**：修改代码时同步检查 `developers/CODE-STYLE.md` 与对应语言/场景细则中的注释/JSDoc 要求；导出函数、共享常量、配置映射、关键数据结构如存在边界或隐含约束，不得省略必要文档注释。
