# 文档维护规则

> 本文件是跨项目通用的文档管理规范，约束 `developers/` 与 `docs/` 的边界、格式与更新要求。

---

## 1. 目录分类与归档规则

| 子目录 | 存放内容 | 典型文件 |
|---|---|---|
| `developers/` | 面向 AI 与人类开发者的协作规范与过程文档 | `INDEX.md`、`DOC-RULES.md`、`CODE-STYLE.md` |
| `developers/ANALYSIS/` | 需求、方案、代码分析文档 | `ANALYSIS_*.md` |
| `developers/REPORTS/` | 质量检查报告 | `CODE_QUALITY_REPORT_*.md` |
| `developers/PLANS/` | 计划文档与计划模板 | `PLAN_*.md`、`TEMPLATE.md` |
| `docs/` | 面向软件使用者的文档 | `INDEX.md` 与产品使用文档 |

---

## 2. 文档版本锚点规范

分析文档（`developers/ANALYSIS/`）和质量报告（`developers/REPORTS/`）必须带版本锚点。

### 2.1 版本锚点字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `创建时间` | 是 | `YYYY-MM-DD HH:mm +08:00` |
| `最后更新` | 是 | `YYYY-MM-DD HH:mm +08:00` |
| `代码快照日期` | 是 | `YYYY-MM-DD` |
| `Git 分支` | 是（有 git 时） | 如 `main` |
| `Git Commit` | 是（有 git 时） | hash 前 7 位 |

---

## 3. 各类文档规范

### 3.1 规范文档（`developers/` 根层）

- 适用范围：长期稳定规则与目录索引。
- 命名规则：全大写短横线风格（例如 `CODE-STYLE.md`）。

### 3.2 分析文档（`developers/ANALYSIS/`）

- 命名：`ANALYSIS_[主题].md`。
- 必须包含：版本锚点、参考代码表、结论/建议。

### 3.3 质量报告（`developers/REPORTS/`）

- 命名：`CODE_QUALITY_REPORT_YYYY-MM-DD_HH-mm-ss.md`。
- 必须包含：报告元信息、检查标准、自动化检查结果、结论与建议、关键命令输出摘录。

### 3.4 计划文档（`developers/PLANS/`）

- 命名：`PLAN_[主题]_[序号].md`，或与 `AGENTS.md` 中计划 ID 一致的可识别文件名。
- 推荐从 `developers/PLANS/TEMPLATE.md` 复制创建。
- 必须包含：目标、分阶段任务、DoD、验收结论。

### 3.5 多语言/场景规范维护（强制）

- 总则：`developers/CODE-STYLE.md`。
- 语言/场景细则：`developers/CODE-STYLES/*_CODE-STYLE.md`。
- 发生语言级或前后端场景级规则变更时，必须同步更新对应细则。

### 3.6 CHANGELOG 维护规范（强制）

项目发布版本时必须维护 `CHANGELOG.md`：
- 格式规范见 `developers/CHANGELOG-RULES.md`。
- 版本号遵循语义化版本（Semantic Versioning）。
- 每个版本需包含版本锚点元信息（创建时间、更新时间、代码快照日期、Git 分支/Commit）。
- 变更记录需关联 Git Commit Hash（7 位）、Issue 编号或 PR 编号。
- 发布前必须将 `[Unreleased]` 更新为实际版本号与日期。

### 3.7 AI 按需加载与 token 控制（强制）

- 执行任务时遵循 `developers/AI-CONTEXT-LOADING.md`。
- 禁止预先全量读取全部文档。

---

## 4. 通用禁止事项

- 禁止无任务需求时主动改动 `docs/` 软件使用文档。
- 禁止文档索引出现不存在链接。
