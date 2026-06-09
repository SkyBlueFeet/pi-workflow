# 设计文档索引（DESIGN）

> 本目录用于存放面向开发者的专题设计文档，聚焦中长期演进、模块重构与关键架构决策。
> 与 `ANALYSIS/` 的区别是：`DESIGN/` 强调目标形态、边界、方案分层与实施路径；`ANALYSIS/` 强调现状调研、证据与问题分析。

---

## 文档列表

| 文档 | 说明 |
|---|---|
| [DESIGN_PI-AGENT-ASSEMBLY.md](./DESIGN_PI-AGENT-ASSEMBLY.md) | 将当前自定义 agent 重构为“PI 原生 Agent 装配 DSL”的定义文档；实现步骤见 `../PLANS/pi-workflow-phases/PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md` |

---

## 维护约定

1. 设计文档优先描述目标形态、适用范围、非目标、模块边界与分阶段落地路径。
2. 若方案依赖当前代码实现，应明确列出受影响模块与兼容策略，避免只写概念不写落点。
3. 当设计已进入实施阶段，应同步更新相关计划或索引入口，避免目录中存在孤立文档。
