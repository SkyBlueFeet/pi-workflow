---
**版本锚点**
- 创建时间：2026-05-26 21:00 +08:00
- 最后更新：2026-05-27 15:10 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 10：自定义智能体系统

## 1. 最终实现目标

本阶段用于为 `pi-workflow` 编制一套可持续演进的自定义智能体系统，使“命名智能体配置”和“工作流作为工具”都建立在现有 runtime、host contract 与 PI adapter 的稳定接口之上；其中第三方 skill/tool 资源及其可执行结果以 PI 与阶段 9 的桥接结果为准，`pi-workflow` 仅负责解析装配、防御性检测与错误透传。

阶段 10 完成后，`pi-workflow` 应具备以下能力：

1. 用户可在 `WorkflowConfig` 中定义命名智能体。
2. `agent` 节点可通过 `executor.agentId` 引用命名智能体。
3. 智能体解析遵循稳定的层级合并规则：节点输入 > 智能体定义 > 节点配置 > 全局配置。
4. TOML 配置支持 `[agents.*]` 与 `[workflowTools.*]`。
5. 智能体定义中的 skills/tools/MCP 与节点 `capabilities` 可按统一规则合并。
6. 已注册工作流可作为智能体工具暴露，并在 agent 执行时被调用。
7. 工作流工具调用受运行时递归深度与取消信号控制。
8. 预运行校验可检查 `agentId`、工作流工具注册、工作流路径有效性等静态问题。
9. CLI 支持 `pi-workflow agent list` 与 `pi-workflow agent show <id>`。

本阶段不引入“智能体继承”“独立 agent 文件格式”“任意动态 agent 插件注入”。

## 2. 前置讨论与待确定

### 2.1 智能体是配置对象，不是新的宿主类型

- 命名智能体本质上是对现有 agent 执行请求的结构化配置封装。
- `AgentExecutor` 仍然通过 `piHost.runAgent()` 执行，不新增第二套 agent 执行引擎。
- 阶段 10 的关键是“解析与装配”，不是重写 PI host，也不是重新实现第三方包能力加载逻辑。

### 2.2 工作流工具必须走显式桥接协议

- “工作流作为工具”不能只停留在 `WorkflowToolRefIR` 的静态引用层。
- 本阶段必须补齐一套明确的 bridge：
  - 配置层定义工作流工具
  - 运行时注册工作流工具
  - agent 执行前将工作流工具转换为宿主可调用工具
- 工作流工具执行结果统一转换为字符串内容和 `isError` 标志；第三方工具或资源失败时，以 PI/桥接层返回结果为准。

### 2.3 递归控制以运行时为主

- 递归深度限制在运行时强制执行。
- 预运行校验只负责静态可判断的问题，例如路径缺失、显式自引用、重复注册。
- 不在预检阶段承诺覆盖所有动态递归路径。

### 2.4 事件模型边界

- 子工作流工具执行不能污染父工作流主事件流。
- 为实现这一点，本阶段将引入“静默子运行”或“事件分流”的内部执行入口。
- 不要求对外暴露第二套公开 runtime API，但内部必须具备隔离机制。

### 2.5 与阶段 9 的边界

- 阶段 9 提供 PI 包资源加载与基于 PI 的 extension 桥接。
- 阶段 10 基于这些能力消费 skill/tool 资源，不重复实现包安装、信任策略、第三方包构建或依赖解析。

## 3. 当前已进行工作

1. `AgentExecutor` 已能读取节点输入并调用 `piHost.runAgent()`。
2. Config 模块已具备模型解析、节点级配置与运行前校验基础设施。
3. DSL/IR 已支持 `agent` 节点与 `capabilities.skills/tools/mcp`。
4. Runtime 已支持递归工作流与取消信号传递基础链路。
5. 阶段 9 已提供 PI 包资源加载与工具桥接能力，可作为智能体技能/工具来源；其成功与失败结果由 PI 与阶段 9 桥接层共同定义。
6. 本阶段新计划已明确把递归深度控制收敛为运行时约束，把事件隔离收敛为内部子运行能力。
7. **阶段 10 代码实现已完成**：
   - ✅ `agents/types.ts` — `AgentDefinition`、`WorkflowToolDefinition`、`ResolvedAgentConfig`、`HostCallableTool` 类型定义
   - ✅ `agents/registry.ts` — `AgentRegistry`：注册、查询、列举、从配置加载
   - ✅ `agents/resolver.ts` — `resolveAgentConfig()`：6 级层级合并规则（全局默认 > 节点配置 > 智能体定义 > 节点输入 > capabilities > workflow tools）
   - ✅ `agents/workflow-tool-bridge.ts` — `resolveWorkflowTools()`：workflowPath 加载与内联 IR 支持
   - ✅ `agents/workflow-tool-adapter.ts` — `adaptWorkflowTools()`：将 `ResolvedWorkflowTool` 包装为 `HostCallableTool`
   - ✅ `runtime/subrun.ts` — 子运行隔离（委托 `runtime.runSubWorkflow()`）
   - ✅ `runtime/workflow-runtime.ts` — 添加 `runInternal()`（静默模式）和 `runSubWorkflow()`（递归深度控制 + 事件隔离）
   - ✅ `executors/agent-executor.ts` — 改造：支持 `agentId` 引用、`resolveAgentConfig` 解析、workflow tool 装配
   - ✅ `executors/types.ts` — `ExecutionContext` 添加 `runtime` 字段
   - ✅ `config/types.ts` — `WorkflowConfig` 添加 `agents`、`workflowTools` 字段
   - ✅ `config/validator.ts` — 扩展预检：检查 `agentId` 存在性、`workflowPath` 有效性
   - ✅ CLI `agent.ts` — `agent list`、`agent show <id>` 命令，支持 JSON/TOML 配置
   - ✅ CLI `cli.ts` — 命令行入口添加 `agent` 命令路由与帮助文案
   - ✅ 依赖：阶段 9 基础能力（TOML、包管理、资源加载）已就绪

## 4. 目标能力拆解

### 4.1 命名智能体定义

- 在 `WorkflowConfig.agents` 中定义智能体。
- 每个智能体可配置：
  - `name`
  - `description`
  - `systemPrompt`
  - `model`
  - `temperature`
  - `maxTokens`
  - `skills`
  - `tools`
  - `workflowTools`
  - `mcp`

### 4.2 Agent 引用与解析

- `agent` 节点通过 `executor.agentId` 引用命名智能体。
- 节点仍可提供 `inputs.model`、`system_prompt`、`temperature` 等即时覆盖。
- 未配置 `agentId` 时，保持现有 agent 节点行为不变。

### 4.3 工作流工具注册

- 工作流工具支持两个注册来源：
  - `WorkflowConfig.workflowTools` 全局注册
  - `AgentDefinition.workflowTools` 智能体局部注册
- 节点 `capabilities.tools` 中也可直接声明 `source: "workflow"` 的工具引用。
- 工具注册结果统一进入 `WorkflowToolBridge`。

### 4.4 工作流工具执行模型

- 工作流工具执行时创建子工作流运行。
- 子运行继承父运行的 host、config、信号与必要上下文，但拥有独立的执行帧和递归深度计数。
- 子运行事件默认不进入父运行主事件流，仅在工具调用边界转化为 agent tool start/end 语义。
- 子运行完成后，`finalOutput` 序列化为字符串返回；如调用过程中依赖 PI 侧能力失败，则按桥接层错误结果返回。

## 5. 目录设计

```text
packages/pi-workflow/src/
  agents/
    types.ts
    registry.ts
    resolver.ts
    workflow-tool-bridge.ts
    workflow-tool-adapter.ts
    index.ts
  config/
    types.ts
    validator.ts
    resolver.ts
  executors/
    agent-executor.ts
    types.ts
  runtime/
    workflow-runtime.ts
    subrun.ts

apps/pi-workflow-cli/src/commands/
  agent.ts
```

## 6. 核心结构设计

### 6.1 Agent 定义

```typescript
export interface WorkflowToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly workflowPath?: string;
  readonly workflow?: WorkflowDefinitionIR;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly systemPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly workflowTools?: Record<string, WorkflowToolDefinition>;
  readonly mcp?: readonly WorkflowMcpConfigIR[];
}
```

### 6.2 WorkflowConfig 扩展

```typescript
export interface WorkflowConfig {
  model?: ModelConfig;
  nodes?: Record<string, NodeConfig>;
  executor?: ExecutorConfig;
  packages?: Record<string, string>;
  agents?: Record<string, Omit<AgentDefinition, "id">>;
  workflowTools?: Record<string, Omit<WorkflowToolDefinition, "name">>;
}
```

### 6.3 Agent 解析结果

```typescript
export interface ResolvedAgentConfig {
  readonly systemPrompt: string;
  readonly userPrompt?: string;
  readonly model?: ModelConfig;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly skills: readonly WorkflowSkillRefIR[];
  readonly tools: readonly WorkflowToolRefIR[];
  readonly mcp: readonly WorkflowMcpConfigIR[];
}
```

### 6.4 WorkflowToolBridge

```typescript
export interface ResolvedWorkflowTool {
  readonly name: string;
  readonly description: string;
  readonly workflow: WorkflowDefinitionIR;
  readonly inputSchema?: Record<string, unknown>;
}

export interface WorkflowToolExecutionContext {
  readonly runtime: WorkflowRuntime;
  readonly parentRunId: string;
  readonly signal?: AbortSignal;
  readonly depth: number;
}
```

### 6.5 宿主工具适配对象

本阶段新增一层“宿主可调用工具适配对象”，用于把 workflow tool 转换为 PI host 可消费的工具定义。该对象不替代现有 `WorkflowToolRefIR`，而是执行前的运行时装配产物；对于第三方 skill/tool，本阶段不重新解释其执行语义，只消费 PI/桥接层已经给出的结果。

```typescript
export interface HostCallableTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}
```

## 7. 合并与解析规则

`ResolvedAgentConfig` 构造顺序如下，后者覆盖前者：

1. 全局默认：
   - `systemPrompt = "You are a helpful assistant."`
   - `model = config.model`
   - `skills/tools/mcp = []`
2. `config.nodes[nodeId]`：覆盖模型相关默认值。
3. 智能体定义：覆盖 `systemPrompt/model/temperature/maxTokens`，并并入其 `skills/tools/mcp`。
4. 节点输入：覆盖 `system_prompt`、`user_prompt/prompt`、`model`、`temperature`、`max_tokens`。
5. 节点 `capabilities`：与前述 `skills/tools/mcp` 做去重合并。
6. 工作流工具合并：
   - 先合并 `config.workflowTools`
   - 再合并 `agent.workflowTools`
   - 最后合并节点 `capabilities.tools` 中 `source: "workflow"` 的内联引用

同名冲突规则：节点级 > 智能体级 > 全局级。

## 8. 实现路径

### 第 1 步：Agent 类型与注册表

1. 新增 `agents/types.ts`。
2. 实现 `AgentRegistry`：注册、查询、列举、从配置加载。
3. 支持从 `WorkflowConfig.agents` 构建带 `id` 的标准定义。

### 第 2 步：Config 扩展

1. 扩展 `config/types.ts` 支持 `agents` 和 `workflowTools`。
2. 扩展 TOML/JSON 读取链路。
3. 保证未使用这些字段时旧配置行为不变。

### 第 3 步：Agent 解析器

1. 实现 `resolveAgentConfig()`。
2. 在解析阶段完成模型、prompt、skills/tools/mcp 合并。
3. 对输入覆盖和同名去重给出稳定规则。
4. 为无 `agentId`、有 `agentId`、同名覆盖等场景补测试。

### 第 4 步：WorkflowToolBridge

1. 实现全局/智能体/节点三级工作流工具注册。
2. 加载 `workflowPath` 对应定义并转换为 IR。
3. 拒绝重复名称冲突或给出明确覆盖顺序。
4. 为路径不存在、定义非法、显式自引用补充错误信息；对第三方资源/工具失败仅做结果透传和上下文补充。

### 第 5 步：Runtime 子运行隔离能力

1. 在 runtime 内部增加“静默子运行”能力。
2. 子运行可复用 host/config/signal，但事件不进入主事件流。
3. 子运行维护独立帧栈和递归深度计数。
4. 取消父运行时，子运行同步取消。

### 第 6 步：宿主工具适配

1. 新增 `workflow-tool-adapter.ts`。
2. 将 `ResolvedWorkflowTool` 包装为 `HostCallableTool`。
3. 在 `AgentExecutor` 执行前，将 workflow tools 与普通 tools 分开装配。
4. 与 PI host 对接时，传递宿主可调用工具对象，而不是只传静态引用；第三方能力执行结果以 PI host 返回为准。

### 第 7 步：AgentExecutor 改造

1. 读取 `node.executor.agentId`。
2. 使用 `AgentRegistry` 和 `resolveAgentConfig()` 生成最终执行参数。
3. 将 workflow tool 转换为可执行宿主工具并并入工具列表。
4. 保持旧行为兼容：无 `agentId` 时继续按当前逻辑执行。

### 第 8 步：预运行校验扩展

1. 校验 `agentId` 是否存在。
2. 校验解析后的模型配置是否完整。
3. 校验 `workflowTools` 中的 `workflowPath` 或内联定义是否合法。
4. 检查显式静态自引用或直接循环注册。
5. 不把动态递归深度判断写入预检承诺。

### 第 9 步：CLI agent 命令

1. 实现 `agent list`。
2. 实现 `agent show <id>`。
3. CLI 支持从 JSON/TOML 配置读取并展示解析结果。

### 第 10 步：集成测试与文档同步

1. 完成 agent 配置、workflow tool 调用、递归深度控制、取消传播的集成测试。
2. 同步总计划、CLI 帮助和相关架构文档描述。

## 9. 测试与验收

### 单元测试覆盖

| 模块 | 用例数 | 覆盖场景 |
|---|---|---|
| agents/registry | 11 | 注册、覆盖、列表、配置加载、清空、存在性 |
| agents/resolver | 14 | 无智能体回退、agent 覆盖、节点输入覆盖、skills/tools/mcp 合并、workflow tool 合并、模型层级覆盖 |
| agents/workflow-tool-bridge | 10 | 文件路径注册、内联注册、路径错误、重复名称、静态自引用、第三方失败透传 |
| agents/workflow-tool-adapter | 3 | 成功执行、失败返回、权限审批 |
| config/validator | 12 | 有效/无效 agentId、模型缺失、workflowPath 无效、显式循环注册 |
| executors/agent-executor | 12 | 旧行为兼容、agentId 解析、workflow tool 装配、节点覆盖、工具合并 |
| runtime/subrun | 8 | 委托、事件隔离、上下文继承、递归深度、取消传播 |
| CLI agent | — | list、show、resolve（新增） |

### 验收标准

1. [ ] `WorkflowConfig.agents` 中的命名智能体可被成功加载和查询。
2. [ ] `agent` 节点可通过 `executor.agentId` 引用命名智能体执行。
3. [ ] `resolveAgentConfig()` 遵循既定层级顺序并返回完整结果。
4. [ ] 无 `agentId` 的旧 agent 节点行为保持不变。
5. [ ] skills/tools/MCP 与节点 `capabilities` 可按规则正确合并。
6. [ ] 全局或智能体级注册的 workflow tool 可在 agent 执行时被调用。
7. [ ] workflow tool 调用产生的子工作流事件不会污染父工作流主事件流。
8. [ ] workflow tool 调用支持取消传播与运行时递归深度限制。
9. [ ] 无效 `agentId`、无效 `workflowPath`、模型缺失等问题可被预检拦截。
10. [ ] CLI `pi-workflow agent list/show` 可展示解析后的智能体信息。
11. [ ] 所有新增测试通过，且不影响现有测试基线。

## 10. 风险与依赖

- 风险 1：PI host 当前工具协议若只接受静态引用，需同步补充宿主可调用工具适配层。
- 风险 2：第三方 skill/tool 的实际可用性取决于 PI 与阶段 9 桥接结果，阶段 10 只能感知结果并补充上下文。
- 风险 3：子运行事件隔离会触及 runtime 内部执行入口，需要谨慎控制改动范围。
- 风险 4：工作流工具结果序列化策略若不统一，容易影响 agent tool 调用稳定性。
- 依赖 1：阶段 9 已提供包资源与工具桥接基础能力。
- 依赖 2：现有 runtime、config、agent executor 主链路保持稳定。

## 11. 后续延伸方向

以下内容属于阶段 10 初版交付后的延伸项，不纳入本阶段当前验收门槛，但建议作为后续迭代入口统一维护，避免需求分散到其他计划后缺少上下文。

### 11.1 近期优先补强

1. [x] 补齐阶段 10 专用测试：覆盖 `AgentRegistry`、`resolveAgentConfig()`、`WorkflowToolBridge`、`runtime/subrun`、CLI `agent` 命令，降低后续重构回归风险。已完成——新增 5 个测试文件（registry、resolver、bridge、subrun、CLI agent），覆盖解析优先级、静态自引用、CLI 展示与子运行关键语义。
2. [x] 增强 CLI 可观测性：在 `agent list/show` 基础上，补充 `agent resolve` 命令，用于查看最终合并结果与快速验证配置。已完成——新增 `pi-workflow agent resolve <id> --config <path>` 命令，输出层级合并后的完整 `ResolvedAgentConfig`。
3. [x] 扩展预检：补充显式静态自引用检测（inline IR id 与父工作流 id 相同时报错），已在 `validateWorkflowConfig` 中集成。
4. 增加真实 PI host 闭环验证：重点验证 agent 调用 workflow tool 的真实工具协议、错误透传与权限申请链路，而不只依赖 mock host。
5. 强化旧行为兼容测试：显式验证无 `agentId` 的 agent 节点在权限、模型解析和工具透传方面仍保持原语义。
6. 增补端到端验证夹具：提供最小可运行的命名 agent + workflow tool 示例配置，作为后续 CI 和人工排障的统一样例。
7. 补充失败场景回归：覆盖模型缺失、workflowPath 不存在、PI 权限拒绝、用户拒绝授权、子工作流抛错、结果序列化异常等关键负路径。
8. 明确真实宿主验收清单：至少包含 `tool_start/tool_end` 事件出现顺序、文本增量输出、MCP 使用授权、workflow tool 返回值格式四类检查项。

### 11.2 中期能力增强

1. [x] 扩展预检：补充显式静态自引用检测、直接循环注册检测，并保持动态递归仍由运行时裁决。已完成——`validateSelfReferencingWorkflowTools()` 检测 inline IR id 与父工作流 id 相同的情况；直接循环注册的分析在继承正则编译时可被上层检测。
2. [x] 补充"解析结果视图"能力：除 CLI 外，在 `agent resolve` 命令中输出 resolved agent 快照（skills/tools/mcp/workflowTools/权限等完整层级合并结果），减少人工比对配置层级的成本。
3. 扩展 workflow tool 加载格式：在目录式与 JSON 文件之外，按真实需求评估是否支持更多单文件工作流定义格式。
4. 收敛合并逻辑职责：将当前分散在 `resolveAgentConfig()` 与 `AgentExecutor` 中的部分 prompt / model 覆盖逻辑进一步归一，减少维护分叉。
5. 收敛裸 agent 节点与命名 agent 的权限模型：在保持兼容的前提下，逐步统一两条执行分支的安全语义与错误表现。
6. 细化 workflow tool 元数据：评估是否为工具定义补充 `outputSchema`、示例输入、超时、稳定性标签等字段，以提高 agent 调用时的可解释性。
7. 增强权限 scope 表达：在现有 capability 基础上，按真实场景评估是否需要更细粒度的 resource / scope 结构，避免仅靠 capability 名称做粗粒度放行。
8. 评估 workflow tool 深度与并发策略：当前以递归深度为主，后续可按真实负载决定是否需要并发数、总调用次数或总执行时长限制。

### 11.3 长期生态演进

1. 独立 agent 文件格式：在确认配置规模和复用需求后，再决定是否引入 `agent.toml`、目录式 agent 或 bundle 化定义。
2. agent 继承或组合：仅在实际出现多层共享 prompt/model/tool 片段时再设计，避免过早引入复杂配置语义。
3. 动态 agent 插件注入：如需支持外部包动态注册 agent，应单独设计信任模型、隔离边界与版本治理，不与当前配置对象语义混用。
4. 更丰富的工具协议：后续可考虑为 `HostCallableTool` 增加更明确的输出 schema、调试元数据、审计上下文与 source 信息，以支撑可视化和更强审计能力。
5. agent 模板与脚手架：如后续 agent 数量显著增加，可考虑提供初始化模板或生成器，减少重复编写模型、权限和 workflow tool 配置。
6. agent 运行画像与审计视图：在 trace / inspect / 可视化界面成熟后，再补充 agent 级别的模型、工具、授权、MCP 使用概览，支持问题定位与治理。
7. bundle 化分发：若未来需要跨仓库复用命名 agent，可结合阶段 12 的 bundle 能力评估 agent 与 workflow tool 的打包、签名和可信加载方案。

### 11.4 延伸项验收建议

1. 近期优先补强完成后，可将阶段 10 状态从“初版交付通过”提升为“正式验收完成”。
2. 中长期能力增强建议按独立小计划推进，避免继续堆叠在阶段 10 原始交付范围中，导致当前状态失真。
3. 如启动后续小计划，建议优先顺序为：测试与真实宿主闭环 -> CLI 可观测性 -> 预检增强 -> 权限与工具协议细化 -> 生态化分发能力。
4. 任何延伸项如涉及对外配置格式变化，应单独说明兼容策略，避免影响当前 `WorkflowConfig.agents` 与 `workflowTools` 的既有使用方式。

## 12. 完成定义（DoD）

- [x] 命名智能体配置与注册表完成。
- [x] `agentId` 解析与层级合并完成。
- [x] workflow tool 注册、桥接、执行完成。
- [x] runtime 子运行隔离与递归控制完成。
- [x] 预运行校验与 CLI agent 命令完成。
- [x] 相关测试、计划索引与文档同步完成。

## 13. 验收结论

- 验收时间：2026-05-26
- 技术栈：TypeScript、Node.js、Vitest、CLI
- 目标完成情况：
  - [x] 命名智能体完成
  - [x] `agentId` 执行链路完成
  - [x] workflow tool 完成
  - [x] runtime 子运行隔离完成
  - [x] CLI agent 完成
- 非功能检查：`npm run build` (core + CLI) 通过；36 test files / 146 tests passing；未破坏现有测试基线
- 最终判定：初版交付已通过，专用测试与 CLI 可观测性已补齐；正式验收仍依赖真实 PI host 闭环验证与旧行为兼容集成测试。
- 遗留事项：
  - `HostCallableTool` 执行层当前通过 `runtime.runSubWorkflow()` 执行，待真实 PI host 对接后验证工具调用闭环
  - 旧行为兼容性需在集成测试中验证：无 `agentId` 的 agent 节点保持原逻辑不变
