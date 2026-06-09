---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-06-09 22:55 +08:00
- 代码快照日期：2026-05-30

---

# Pi Workflow 阶段计划索引

本目录把 `Pi Workflow` 开发计划拆分为独立阶段文件。

每个阶段文件采用统一结构：

1. **最终实现目标**：该阶段完成后系统应具备的确定能力。
2. **前置讨论与待确定**：进入开发前需要讨论、调研或拍板的内容。
3. **当前已进行工作**：已经完成的文档、调研、代码或上下文准备。
4. **目录设计**：该阶段涉及的文件与模块。
5. **结构设计**：核心类型、接口与边界。
6. **实现路径**：确定后按顺序执行的开发步骤。
7. **测试与验收**：阶段完成标准。

阶段文件：

- [阶段 0：基线与工程骨架](./PLAN_PHASE-0_BASELINE-AND-SKELETON.md)
- [阶段 1：pi-native DSL 与 Workflow IR v0](./PLAN_PHASE-1_DSL-AND-IR.md)
- [阶段 2：确定性 Runtime MVP](./PLAN_PHASE-2_RUNTIME-MVP.md)
- [阶段 3：Store、Interaction 与 Resume](./PLAN_PHASE-3_STORE-INTERACTION-RESUME.md)
- [阶段 4：PI npm Adapter MVP 与 Agent Executor](./PLAN_PHASE-4_PI-NPM-ADAPTER-AGENT.md)
- [阶段 5：通用节点扩展](./PLAN_PHASE-5_GENERAL-NODES.md)
- [阶段 6：目录加载器与文件化 DSL](./PLAN_PHASE-6_WORKFLOWDEFINE-IMPORTER.md)
- [阶段 7：AI-First Authoring](./PLAN_PHASE-7_AI-FIRST-AUTHORING.md)
- [阶段 8：调试与可视化](./PLAN_PHASE-8_DEBUG-AND-VISUALIZATION.md)
- [阶段 9：PI 生态集成 ✅](./PLAN_PHASE-9_PI-ECOSYSTEM-INTEGRATION.md) — 初版交付已通过
- [阶段 10：自定义智能体系统](./PLAN_PHASE-10_CUSTOM-AGENT-SYSTEM.md) — 记录当前已完成的独立 agent 基础设施，供后续主链路复用
- [阶段 10 专项：PI Agent Assembly 装配 DSL 实施收口](./PLAN_PHASE-10_PI-AGENT-ASSEMBLY-IMPLEMENTATION.md) — 阶段 10 的主目标计划，聚焦 `pi-tui` 默认运行面、Assembly DSL 收口、默认 coding agent 与外部 agent 地址引用
- [阶段 11：软件安全策略 ✅](./PLAN_PHASE-11_SOFTWARE-SECURITY-POLICY.md) — 主链路已完成，可继续细化权限 scope 与可视化表现
- [阶段 12：PWB Bundle 运行态](./PLAN_PHASE-12_PWB-BUNDLE-RUNTIME.md)
- [阶段 13：PI 宿主工具与基础工具迁移](./PLAN_PHASE-13_PI-HOST-TOOLS-AND-FILE-CAPABILITIES.md) — 规划中，聚焦 `callTool()`、`read/write/edit/ls/grep/find` 迁移与 `tool` 节点宿主闭环
- [阶段 14：Web 工作流节点编辑器](./PLAN_PHASE-14_WEB-WORKFLOW-EDITOR.md) — 开发中，React + ReactFlow 可视化编辑器已可独立运行，当前“保存”口径为浏览器导出下载

总览文档：

- [Pi Workflow 总开发计划](../PLAN_PI-WORKFLOW-DEVELOPMENT.md)
- [Pi Workflow 架构设计文档](../../pi-workflow-architecture.md)
- [Pi Workflow 开发演进路线](../../pi-workflow-evolution.md)
