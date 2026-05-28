---
**版本锚点**
- 创建时间：2026-05-26 00:00 +08:00
- 最后更新：2026-05-28 00:00 +08:00
- 代码快照日期：2026-05-28
- Git 分支：main
- Git Commit：未创建（仓库当前无提交）

---

# CHANGELOG

本文档记录项目版本发布与变更历史。

## [Unreleased]

### Added

## [v1.0.0] - 2026-05-28

### Added
- 首个正式版本发布，交付可运行的 Pi Workflow 主链路
- `@pi-workflow/core` 核心运行时：覆盖 DSL 加载、IR 映射、计划生成、节点调度、事件输出与状态持久化
- 目录式 DSL 支持：以 `flow.json`、`nodes/`、`prompts/`、`stages/` 组织工作流定义
- 基础节点能力：支持 `manual`、`return`、`workflow` 三类确定性节点
- 通用编排节点：支持 `tool`、`http`、`if`、`parallel`、`loop` 控制流与外部调用能力
- 可恢复执行模型：提供完整运行态与轻量 checkpoint，支持暂停、恢复与节点边界重入
- 递归子工作流执行：`workflow` 节点可展开子流程并维护显式执行帧栈
- PI 宿主适配能力：提供 Agent 执行接入、PI 包适配与扩展加载基础设施
- AI-First Authoring 能力：覆盖工作流编写、修订、检查相关模块
- 调试与可视化基础能力：提供运行事件、调试信息与可视化演进基础
- CLI 工具 `pi-workflow`：支持运行、恢复与检查工作流
- Monorepo 工程结构：包含 `@pi-workflow/core`、`@pi-workflow/pi-package-adapter`、`@pi-workflow/extension-loader`、`@pi-workflow/builtin-tools` 与 `pi-workflow-cli`
- 开发与治理基础设施：包含 TypeScript 构建、Vitest 测试、ESLint 校验及开发者规范文档体系
