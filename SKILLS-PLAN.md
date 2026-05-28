# SKILLS-PLAN

## 1. 目标与范围

### 核心目标

让 AI Agent 在**同一次对话中**完成功能实现、问题修复、方案落地后，**自动执行收尾动作**（留痕、进度更新、质量检查），不依赖人的主动提醒。

根本机制：在 `SKILL_ROUTER.md` 中为每类任务定义"完成后必做"列表，使收尾动作成为任务本身的一部分，而非可选步骤。

### 范围

- 保留规则源文档（`AGENTS.md`、`developers/DOC-RULES.md`、`developers/CODE-STYLE.md`、`developers/AI-CONTEXT-LOADING.md`）。
- 将任务执行入口统一到 `developers/SKILLS/SKILL_ROUTER.md`。
- 通过 npm CLI（`init/add/sync/doctor`）实现可安装、可升级、可体检、可审计。

非目标：

- 不实现跨对话的自动巡逻或定时触发。
- 不移除现有规则文档。
- 不在一次改造中重写全部历史文档。

---

## 2. 设计原则

1. **规则与执行分层**：规则文档是"约束源"，Skill 是"执行入口"。
2. **完成即触发**：每类任务在 SKILL_ROUTER 中明确"完成后必做"动作，AI 视其为任务本身的一部分。
3. **单一入口**：Agent 执行任何任务前，首先查阅 `SKILL_ROUTER.md` 获取读取集与收尾要求。
4. **可机检**：所有关键约束可被 `doctor` 校验，CI 作为人工流程的兜底门禁。
5. **渐进迁移**：先兼容、再收口、最后清理旧入口。

---

## 3. 目标结构

### 3.1 文档结构（目标态）

```text
AGENTS.md
SKILLS-PLAN.md
developers/
  INDEX.md
  DOC-RULES.md
  CODE-STYLE.md
  AI-CONTEXT-LOADING.md
  CODE-STYLES/
  SKILLS/
    README.md
    SKILL_ROUTER.md           ← 统一入口，含完成后必做规则
    SKILL_BOOTSTRAP.md        ← 新项目初始化与最低可用检查
    SKILL_DOC_GOVERNANCE.md   ← 文档更新流程 + 留痕
    SKILL_CODE_GOVERNANCE.md  ← 代码改动流程 + 语言/场景规范路由
    SKILL_PLAN_INDEX.md       ← 计划生命周期管理
    SKILL_CODE_QUALITY_CHECK.md
    SKILL_ACCEPTANCE.md
    SKILL_SNAPSHOT.md
```

### 3.2 SKILL_ROUTER 核心结构（目标态）

每类任务的路由条目包含四个字段：

```
任务类型 | 执行前读取最小集 | 执行中约束 | 完成后必做
```

"完成后必做"是本方案的核心机制，示例：

| 任务类型 | 完成后必做 |
|---|---|
| 功能实现 / 问题修复 | 质量检查 → 会话留痕 → 计划进度更新 |
| 文档新建 / 修改 | DOC-RULES 合规检查 → 会话留痕 |
| 计划创建 / 完成 | 计划索引同步（AGENTS.md）→ 会话留痕 |
| 新项目初始化 | SKILL_BOOTSTRAP 验收 → 会话留痕 |

### 3.3 执行入口规则（目标态）

- `AGENTS.md`：声明"任务开始前读 `SKILL_ROUTER.md`，任务结束后按其收尾规则执行"。
- `developers/INDEX.md`：首屏优先展示 Skill 路由与 Skill 清单。
- 旧入口文档保留，顶部增加"Skill 优先入口"说明。

---

## 4. 分阶段实施

### Phase 1：触发机制建立（最高优先级）

目标：建立"完成即触发"的核心机制，不破坏现有流程。

任务：

1. 新增 `SKILL_ROUTER.md`：任务类型 → 读取最小集 → 执行约束 → **完成后必做**。
2. 新增 `SKILL_BOOTSTRAP.md`：新项目初始化流程与最低可用检查。
3. 更新 `AGENTS.md`：
   - 任务入口速查表改为指向 `SKILL_ROUTER.md`。
   - 通用原则中"留痕必做"细化为可执行的收尾步骤描述。
4. 更新 `developers/INDEX.md`：首屏展示 SKILL_ROUTER 入口。

交付物：`SKILL_ROUTER.md`、`SKILL_BOOTSTRAP.md`、入口文档更新。

验收：

- 新任务可以仅依赖 `SKILL_ROUTER` 完成路由和收尾。
- 不影响现有 `CODE-STYLE` / `DOC-RULES` 使用。

---

### Phase 2：治理 Skill 化（次优先级）

目标：将关键治理流程 Skill 化，为 SKILL_ROUTER 的"完成后必做"提供可执行的操作文档。

任务：

1. 新增 `SKILL_DOC_GOVERNANCE.md`：文档更新流程 + 留痕 + 版本锚点。
2. 新增 `SKILL_CODE_GOVERNANCE.md`：代码改动流程 + 语言/场景规范路由 + 质量门禁。
3. 新增 `SKILL_PLAN_INDEX.md`：计划创建 / 更新 / 完成 / 撤销的操作步骤，明确 `AGENTS.md` 为唯一权威源。

交付物：三份治理 Skill 文档。

验收：

- `doctor` 可识别计划索引口径冲突并告警。
- 执行治理任务时 AI 优先引用 Skill 文档而非原始规则文档。

---

### Phase 3：CLI 增强（低优先级）

目标：CLI 从"模板复制器"升级为"Skill 包管理器"，支持版本感知。

任务：

1. 引入 `skills.lock.json`（记录已安装 Skill 与版本）。
2. `add` 支持 `skill-pack` 预设包（如 `core / frontend / backend-node / python`）。
3. `sync` 基于 lock 做差量同步与版本提示。
4. `doctor` 增加 Skill 专项体检：Router 存在性、Skill 链路可达性、Rule/Skill 口径冲突。

交付物：`skills.lock.json`、CLI 命令增强。

验收：目标项目可通过 `init + add + sync + doctor` 完成 Skill 生命周期管理。

---

### Phase 4：CI 门禁（兜底保障）

目标：确保 Skill 约束"可生效"，弥补对话外的流程漏洞。

任务：

1. 在 CI 接入 `doctor`，错误即失败。
2. 关键仓库接入 `sync --check`，检测模板漂移。
3. 发布迁移公告，标注旧入口弃用周期；周期后清理冗余入口。

交付物：CI 配置片段、迁移说明文档。

验收：PR 可自动发现缺失 Skill / 断链 / 口径冲突，规范执行不依赖人工记忆。

---

## 5. 优先级排序

```text
Phase 1（触发机制）> Phase 2（治理文档）> Phase 4（CI 门禁）> Phase 3（CLI 增强）
```

Phase 1 + Phase 2 完成后，核心目标（AI 对话内自动收尾）即已达到。
Phase 4 是对话外的兜底保障，独立推进。
Phase 3 是可选的工程化提升，不影响核心目标。

---

## 6. 风险与回滚

风险：

1. SKILL_ROUTER 规则过重，导致 AI 每次任务都执行冗余步骤。
2. 规则与 Skill 双轨期间，Agent 可能路由到错误文档。
3. CLI 升级后与已有项目模板不兼容。

应对：

1. SKILL_ROUTER 中区分"必做"与"按需做"，避免过度触发。
2. `doctor` 增加冲突检测并给出修复建议；过渡期保留旧入口兼容说明。
3. `sync --check` 先行，`--apply` 后置。

回滚策略：

1. 保留旧入口文档不删除。
2. CLI 每次升级前保留 lock 与变更摘要。
3. 出现阻断时回退到上一版本模板与 lock。

---

## 7. 完成定义（DoD）

满足以下条件即视为 Skill 化方案落地完成：

1. `SKILL_ROUTER` 成为统一入口，含"完成后必做"规则，并被 `AGENTS.md` 显式引用。
2. 核心治理任务均存在对应 Skill 文档。
3. AI 在对话中完成实现类任务后，无需人工提醒即自动执行留痕与进度更新。
4. CLI 支持 Skill 的安装、同步、体检。
5. CI 已接入 `doctor` 门禁。
6. 会话留痕与计划索引维护流程仍保持可追溯。
