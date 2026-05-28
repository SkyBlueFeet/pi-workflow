---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 10:00 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 4：PI npm Adapter MVP 与 Agent Executor

## 1. 最终实现目标

阶段 4 完成后，workflow runtime 应能通过 PI npm adapter 使用 PI 生态能力，并跑通 agent 节点最小闭环。

目标能力：

1. 实现 `agent` executor。
2. 实现 `PiWorkflowHostAdapter`。
3. 通过外部 PI npm 包驱动 Agent 运行。
4. 发现并解析 PI package resources。
5. 将第三方 PI package 的 extension、skill、prompt、tool 统一转换为 workflow capability catalog。
6. 支持 node 级能力 scope。
7. 支持 agent 节点引用第三方 skill/prompt/tool。
8. CLI 可运行 PI-backed agent workflow。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. PI npm 依赖入口：
   - `createAgentSession`。
   - `DefaultResourceLoader`。
   - `ResourceLoader` 类型。
   - Session/checkpoint API。
   - Tool 注册与调用 API。
2. PI package 使用路径：
   - 复用 PI 已安装 package。
   - workflow 声明 package 后由 `pi-workflow` 解析安装。
   - 两者都支持。
3. package source 支持范围：
   - `npm:`。
   - `git:`。
   - 本地路径。
4. `resources.piPackages` DSL 结构：
   - alias。
   - source。
   - version。
   - use scope。
5. extension 注册 tool 的发现方式：
   - 通过 PI ResourceLoader 初始化 extension。
   - 通过 adapter 捕获注册结果。
   - 通过 manifest 静态声明。
6. package capability catalog 的最小字段。
7. 节点级 scope 规则：
   - agent 可用 skill/prompt/tool。
   - 正式 tool 节点调用 tool 的执行语义在阶段 5 定义。
   - 子 workflow 的继承与收窄规则。
8. 第三方能力包安全策略：
   - 显式 allowlist。
   - workflow 声明授权。
   - CLI 参数授权。
   - package trust policy。
9. 真实 LLM 调用测试策略：
   - 默认 mock。
   - opt-in integration test。
10. PI event 到 workflow event 的映射表。
11. 阶段 4 与阶段 5 的边界：
    - 阶段 4 只支持 agent 节点引用第三方 skill/prompt/tool。
    - 阶段 4 的 tool capability 只作为 agent 调用上下文或 adapter 内部能力暴露。
    - 正式 `tool` 节点执行第三方 package tool 推迟到阶段 5。

## 3. 当前已进行工作

已完成：

1. 总览计划已定义 PI npm adapter 为正式模块。
2. 总览计划已新增 PI 生态能力包接入模型。
3. 已设计 `resources.piPackages` DSL 示例。
4. 已设计 `WorkflowCapabilityCatalog`。
5. 已设计 `PiPackageResolver`、`PiResourceLoaderBridge`、`PiCapabilityCatalogBuilder`、`PiCapabilityScopeResolver`。
6. 已确认 `pi/` 参考文档中 PI package 可通过 npm/git 安装，并可包含 extensions、skills、prompts、themes。
7. 已确认 PI SDK 参考文档中存在 `DefaultResourceLoader` 与 `createAgentSession` 使用方式。

已完成（代码已落地）：

1. ✅ PiWorkflowHostAdapter：`src/adapters/pi/pi-host-adapter.ts`
2. ✅ PiCapabilityCatalog：`src/adapters/pi/pi-capability-catalog.ts`
3. ✅ PiEventMapper：`src/adapters/pi/pi-event-mapper.ts`
4. ✅ PiMockHost：`src/adapters/pi/pi-mock-host.ts`
5. ✅ WorkflowPiHostCapabilities / PI 类型：`src/adapters/pi/types.ts`
6. ✅ AgentExecutor：`src/executors/agent-executor.ts`
7. ✅ adapter contract tests 通过（7 个测试用例）
8. ✅ AgentExecutor 测试通过（5 个测试用例）
9. ✅ PI agent mock spike：`examples/pi-agent-smoke.ts`

额外完成 — Agent 节点规范接口定义：

- ✅ DSL 类型：`WorkflowDslAgentConfig` + `WorkflowDslSkillRef` / `ToolRef` / `McpConfig`
- ✅ IR 类型：`WorkflowAgentConfigIR` + `WorkflowSkillRefIR` / `ToolRefIR` / `McpConfigIR`
- ✅ `WorkflowDslNode` / `WorkflowNodeIR` 增加 `agent?` 字段
- ✅ mapper 新增 agent config 传播
- ✅ `WorkflowAgentRequest` 全字段标准化（skills / tools / mcp / temperature / maxTokens）
- ✅ 删除旧 `WorkflowToolDef`，统一使用 `WorkflowToolRefIR`
- ✅ DSL 校验 DSL-009 检查 agent 配置完整性
- ✅ 兼容旧版 `prompt` 字段 fallback
- ✅ agent fixture + 验证测试通过

> 注：PI npm 正式依赖入口确认仍为 BLOCKED 状态（内部私有包），不影响阶段 4 现有代码运行。package-backed workflow fixture 与 CLI PI 装配待阶段 4 detail 阶段补齐。

## 4. 目录设计

新增或完善：

```text
src/adapters/pi/
  index.ts
  pi-host-adapter.ts
  pi-agent-runner.ts
  pi-tool-runner.ts
  pi-package-resolver.ts
  pi-resource-loader-bridge.ts
  pi-capability-catalog.ts
  pi-capability-scope.ts
  pi-session-checkpoint.ts
  pi-resource-resolver.ts
  pi-event-mapper.ts
src/executors/
  agent-executor.ts
src/resources/
  types.ts
  resolver.ts
test/executors/
  agent-executor.test.ts
test/host/
  host-contract.test.ts
test/adapters/pi/
  pi-host-adapter.test.ts
  pi-package-resolver.test.ts
  pi-capability-catalog.test.ts
  pi-capability-scope.test.ts
  pi-event-mapper.test.ts
examples/
  agent-summarize.workflow.json
  package-backed-agent-review.workflow.json
apps/pi-workflow-cli/src/commands/
  run.ts
  resume.ts
```

## 5. 结构设计

PI host capability 扩展：

```ts
export interface WorkflowPiHostCapabilities extends WorkflowHostCapabilities {
  runAgent(request: WorkflowAgentRequest): AsyncGenerator<WorkflowHostEvent, WorkflowAgentResult>;
  callTool?(request: WorkflowToolRequest): Promise<WorkflowToolResult>;
  listResources?(query: WorkflowResourceQuery): Promise<WorkflowResourceRef[]>;
  resolveResource?(ref: WorkflowResourceRef): Promise<WorkflowResolvedResource>;
  requestUserInput?(request: WorkflowInteractionRequest): Promise<WorkflowInteractionResult>;
  appendSessionCheckpoint?(checkpoint: WorkflowSessionCheckpoint): Promise<void>;
  readSessionCheckpoints?(): Promise<WorkflowSessionCheckpoint[]>;
}
```

`WorkflowPiHostCapabilities` 是阶段 4 在阶段 2 基础 `WorkflowHostCapabilities` 之上的扩展接口，不替代、不覆盖阶段 2 的最小 host contract。基础 runtime 与 `NullWorkflowHost` 仍只依赖 `emitEvent?`；`agent-executor` 只在 PI-backed 运行模式下要求 `runAgent`，能力缺失时必须返回 structured unsupported diagnostic。

PI package ref：

```ts
export interface WorkflowPiPackageRef {
  alias: string;
  source: string;
  version?: string;
  use?: WorkflowPiPackageUse;
}
```

Capability catalog：

```ts
export interface WorkflowCapabilityCatalog {
  packages: WorkflowPiPackageRef[];
  extensions: WorkflowPiCapabilityRef[];
  skills: WorkflowPiCapabilityRef[];
  prompts: WorkflowPiCapabilityRef[];
  tools: WorkflowPiCapabilityRef[];
  diagnostics: WorkflowDiagnostic[];
}
```

## 6. 实现路径

1. 明确 PI npm 依赖清单。
2. 定稿阶段 1 预留的 PI DSL 扩展：
   - `resources.piPackages`。
   - agent node `skills`。
   - agent node `tools`。
   - `prompt.from = "pi.prompt"`。
3. 在阶段 2 最小 host contract 之上定义 `WorkflowPiHostCapabilities` 扩展，补齐 `runAgent`、`callTool`、`listResources`、`resolveResource`、session checkpoint 等能力；该扩展不得改变基础 `WorkflowHostCapabilities` 的最小形态。
4. 实现 `agent-executor`。
5. 实现 `pi-package-resolver`。
6. 实现 `pi-resource-loader-bridge`。
7. 实现 `pi-capability-catalog`。
8. 实现 `pi-capability-scope`。
9. 实现 `PiWorkflowHostAdapter`。
10. 实现 `pi-agent-runner`。
11. 实现 `pi-tool-runner`，仅供 agent 节点引用第三方 tool capability 与 adapter 内部能力调用；正式 workflow `tool` 节点由阶段 5 装配。
12. 实现 `pi-event-mapper`。
13. 实现 `pi-session-checkpoint`，只负责 checkpoint 索引读写，resume 状态机沿用阶段 3。
14. 实现 `pi-resource-resolver`。
15. 装配 CLI `run` 的 PI-backed agent workflow 模式。
16. 装配 CLI `resume` 的 PI-backed checkpoint 读取与写入，不改变阶段 3 CLI 参数与恢复语义。
17. 编写 `agent-summarize.workflow.json`。
18. 编写 `package-backed-agent-review.workflow.json`。

## 7. 测试与验收

验收标准：

1. mock host 下 agent workflow 可端到端执行。
2. PI npm adapter 下 workflow 可调用 PI Agent 能力。
3. workflow 可声明 PI package 并生成 capability catalog。
4. agent 节点可使用第三方 package 提供的 skill/prompt/tool。
5. 正式 workflow `tool` 节点执行第三方 package tool 不作为阶段 4 验收，移入阶段 5。
6. runtime event 可映射为 CLI/SDK 事件。
7. paused checkpoint 可写入并读取，恢复执行语义仍由阶段 3 resume contract 决定。
8. CLI 可运行 `agent-summarize.workflow.json`。
9. CLI 可运行 `package-backed-agent-review.workflow.json` 并展示 package capability 解析结果。
10. deterministic runtime 与 `NullWorkflowHost` 不需要实现 `runAgent`、`callTool` 或资源查询能力。
