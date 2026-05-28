# Skills 目录说明

> 本目录用于沉淀面向 Agent 的执行手册。
> 目标是把"任务如何做"与"完成后必须做什么"写成可复用、可追溯的标准流程。

---

## 使用原则

| 场景 | 建议入口 |
|---|---|
| 开始任何开发任务 | [SKILL_ROUTER.md](./SKILL_ROUTER.md) |
| 代码实现 / 修复 | [SKILL_CODE_GOVERNANCE.md](./SKILL_CODE_GOVERNANCE.md) |
| 文档新建 / 修改 | [SKILL_DOC_GOVERNANCE.md](./SKILL_DOC_GOVERNANCE.md) |
| 计划状态更新 | [SKILL_PLAN_INDEX.md](./SKILL_PLAN_INDEX.md) |
| 质量检查与验收 | [SKILL_CODE_QUALITY_CHECK.md](./SKILL_CODE_QUALITY_CHECK.md) |

---

## 维护约定

- Skill 内容应保持平台无关，不绑定某个特定 Agent 软件。
- Skill 如引用规范，优先链接 `developers/` 下权威文档。
- Skill 更新时，需同步检查 `SKILL_ROUTER.md` 的路由是否需要调整。
