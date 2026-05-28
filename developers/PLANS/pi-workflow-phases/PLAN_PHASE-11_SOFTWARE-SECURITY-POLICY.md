---
**版本锚点**
- 创建时间：2026-05-26 23:05 +08:00
- 最后更新：2026-05-27 15:30 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 11：软件安全策略

## 1. 最终实现目标

本阶段用于为 `pi-workflow` 编制并落地一套面向 workflow 运行时的软件安全策略，目标不是重做 PI 已有权限体系，而是补全 `pi-workflow` 在系统权限声明、传播、收敛、审计和预检上的缺口。

阶段 11 完成后，`pi-workflow` 应具备以下能力：

1. 支持在 workflow/agent/tool/workflow-tool 级别声明系统权限需求。
2. 支持将权限需求映射到统一的运行时安全策略模型。
3. 支持在父 workflow、子 workflow、agent 节点、workflow tool 之间传播和收敛权限。
4. 支持对文件、网络、命令执行、MCP、第三方 extension 等高风险能力做统一准入检查。
5. 支持运行前安全预检，阻止明显越权或缺失授权的执行请求。
6. 支持最小权限原则：默认拒绝未声明或未授权的高风险能力。
7. 支持安全审计记录，至少覆盖权限决策、拒绝原因、来源节点与运行上下文。
8. 优先复用 PI 生态内已验证的权限/信任相关包与机制，不自造完整独立权限平台。

本阶段不将“系统级隔离沙箱”“容器级安全边界”“操作系统强制访问控制”作为交付目标。

## 2. 前置讨论与待确定

### 2.1 阶段职责边界

- 第 9 阶段负责包接入、信任开关与基础桥接。
- 第 10 阶段负责命名智能体、workflow tool 与递归执行主链路。
- 第 11 阶段负责在既有执行链路之上补权限治理，不回退重写阶段 9-10 的主能力模型。

### 2.2 权限控制范围

- 本阶段重点关注以下权限面：
  - 文件读取
  - 文件写入
  - 网络访问
  - 命令执行
  - MCP server 启动与调用
  - 第三方 extension 执行
  - workflow tool 递归调用
- `manual`、`return` 等纯控制型节点不单独引入系统权限语义。

### 2.3 与 PI 的关系

- 对第三方包、第三方 tool、第三方 extension 的底层能力判断以 PI 内部结果为准。
- `pi-workflow` 负责在 workflow 语义层补充：
  - 权限声明
  - 权限传播
  - 权限收敛
  - 权限预检
  - 权限审计
- 优先使用 `https://pi.dev/packages` 中已验证过的权限、trust、policy 相关包；如 PI 已提供等价能力，则直接适配，不再自研替代实现。

### 2.4 权限继承原则

- 父 workflow 为权限上界。
- 子 workflow、agent、workflow tool 只能继承或降权，不能静默提权。
- 节点局部声明只能在父级已授权范围内生效。
- 默认策略采用 deny-by-default，用显式声明开启高风险权限。

### 2.5 验证与执行边界

- 预检负责静态可判断问题：
  - 缺失权限声明
  - 声明超出上界
  - 明显冲突的策略组合
  - 未受信任 extension 的执行请求
- 运行时负责动态决策问题：
  - 递归调用链中的权限传播
  - agent/tool 实际调用时的权限判定
  - MCP 启动与工具调用时的最终准入

## 3. 当前已进行工作

1. 阶段 4 已建立 `PiHostAdapter` 与 agent 执行主链路。
2. 阶段 5 已建立 `tool/http/if/parallel/loop` 等节点执行链路。
3. 阶段 9 新计划已明确第三方包问题以 PI 内部处理结果为准，workflow 侧只做防御性检测、桥接与错误透传。
4. 阶段 10 新计划已明确命名智能体与 workflow tool 的装配边界，并将递归控制收敛为运行时约束。
5. 当前 runtime 已具备 run/resume、子工作流、取消传播、事件输出等安全策略挂载点。
6. 当前项目尚未形成统一的 workflow 级权限声明、传播、审计模型，本阶段用于补齐该缺口。
7. `WorkflowConfig.security`、`security/policy.ts`、`security/resolver.ts`、`security/validator.ts`、`security/auditor.ts` 已实现并接入运行时主链路。
8. `agent` 与 `workflowTool` 已支持局部 `permissions` 声明；TOML 配置已支持 `agents.*.permissions` 与 `workflowTools.*.permissions`。
9. `validateWorkflowConfig()` 已补充 agent / workflowTool / MCP 的静态权限预检。
10. `AgentExecutor` 与 workflow tool 执行链路已接入权限收敛与运行时拒绝逻辑。
11. 已新增 CLI `policy show|check` 命令，用于查看安全配置与执行运行前安全预检。
12. 已补充阶段 11 首批测试：security/validator、agent-executor、workflow-tool-adapter、PiPermissionBridge、CLI policy。
13. 权限拒绝后已支持通过 ask_user 请求用户授权，区分“一次 / 本次运行 / 永久允许”三档决策。
14. 永久授权已支持写入 `.pi-workflow/trust-policy.json` 的 `securityPermissions` 字段，并在后续运行自动命中。
15. `trace` / `inspect` 已接入安全决策展示，可查看允许/拒绝原因与节点来源。

## 4. 目标能力拆解

### 4.1 安全策略配置

- 在 `WorkflowConfig` 中增加顶层安全策略配置。
- 支持 workflow 默认权限、节点级权限覆盖、agent/workflow-tool 局部权限声明。
- 支持 JSON/TOML 等价配置。

### 4.2 权限模型

- 定义统一权限枚举与资源范围表达。
- 支持以下基础权限：
  - `fs.read`
  - `fs.write`
  - `network.request`
  - `process.execute`
  - `mcp.use`
  - `extension.execute`
  - `workflow.invoke`
- 支持按路径、主机、命令、server 名称等维度附加范围约束。

### 4.3 权限传播与降权

- 父 workflow 到子 workflow：权限做交集传播。
- workflow 到 agent：只暴露 agent 实际需要且已授权的能力。
- workflow tool 到子 workflow：继承父权限上界，并叠加工具局部限制。
- 第三方 extension/tool：必须同时满足 PI 侧结果和 workflow 侧授权。

### 4.4 安全预检

- 在运行前检查：
  - 声明是否完整
  - 权限是否越界
  - 高风险能力是否缺失授权
  - workflow tool 递归链路中是否存在显式越权路径
- 对动态运行才可判定的情形，仅给出 warning 或运行时决策说明。

### 4.5 安全执行与审计

- 运行时在真正调用高风险能力前做权限判定。
- 每次拒绝需记录：
  - runId
  - nodeId
  - actor 类型（workflow/agent/tool/workflow-tool/extension）
  - 请求权限
  - 拒绝原因
- 支持审计事件输出与后续 trace/inspect 集成。

## 5. 目录设计

```text
packages/pi-workflow/src/
  security/
    types.ts
    policy.ts
    resolver.ts
    validator.ts
    auditor.ts
    permissions.ts
  config/
    types.ts
    validator.ts
  runtime/
    workflow-runtime.ts
    subrun.ts
  executors/
    agent-executor.ts
    tool-executor.ts
    http-executor.ts
  adapters/pi/
    permission-bridge.ts

apps/pi-workflow-cli/src/commands/
  policy.ts
```

## 6. 核心结构设计

### 6.1 安全策略配置

```typescript
export interface WorkflowSecurityConfig {
  readonly defaultMode?: "deny" | "allow-known-safe";
  readonly permissions?: readonly PermissionGrant[];
  readonly nodes?: Record<string, NodeSecurityConfig>;
  readonly audit?: SecurityAuditConfig;
}

export interface NodeSecurityConfig {
  readonly permissions?: readonly PermissionGrant[];
}

export interface SecurityAuditConfig {
  readonly enabled?: boolean;
  readonly includeAllowDecisions?: boolean;
  readonly includeDenyDecisions?: boolean;
}
```

### 6.2 权限声明

```typescript
export interface PermissionGrant {
  readonly capability:
    | "fs.read"
    | "fs.write"
    | "network.request"
    | "process.execute"
    | "mcp.use"
    | "extension.execute"
    | "workflow.invoke";
  readonly scope?: Readonly<Record<string, unknown>>;
}
```

### 6.3 解析结果

```typescript
export interface ResolvedSecurityContext {
  readonly runId: string;
  readonly actorType: "workflow" | "agent" | "tool" | "workflow-tool" | "extension";
  readonly grants: readonly PermissionGrant[];
  readonly inheritedFrom?: string;
}
```

### 6.4 审计事件

```typescript
export interface SecurityDecisionEvent {
  readonly runId: string;
  readonly nodeId?: string;
  readonly actorType: "workflow" | "agent" | "tool" | "workflow-tool" | "extension";
  readonly capability: PermissionGrant["capability"];
  readonly decision: "allow" | "deny";
  readonly reason: string;
  readonly timestamp: string;
}
```

## 7. 实现路径

### 第 1 步：盘点权限接触面

1. 盘点 agent、tool、http、workflow tool、extension、MCP 的系统权限触点。
2. 将权限触点映射到统一 capability 枚举。
3. 标记可由 PI 直接治理与需 workflow 补充治理的边界。

### 第 2 步：安全配置与类型扩展

1. 扩展 `WorkflowConfig`，增加 `security` 字段。
2. 为 JSON/TOML 增加安全策略读取能力。
3. 保持旧配置不含 `security` 时仍可运行，但高风险能力默认更严格。

### 第 3 步：权限解析器

1. 实现 `resolveSecurityContext()`。
2. 支持 workflow 默认权限、节点权限、agent/workflow-tool 局部权限求交集。
3. 明确权限提升为非法，权限收缩为合法。

### 第 4 步：运行前安全预检

1. 扩展 `validateWorkflowConfig()` 或新增安全校验入口。
2. 对高风险节点检查是否存在必要权限声明。
3. 对 workflow tool/子 workflow 检查是否存在静态显式越权路径。

### 第 5 步：执行链路接入

1. 在 `AgentExecutor`、`ToolExecutor`、`HttpExecutor`、workflow tool bridge 前挂接权限判定。
2. 将 PI 侧权限结果与 workflow 侧权限决策合并。
3. 对拒绝执行场景输出清晰错误。

### 第 6 步：MCP 与 extension 权限桥接

1. 为 MCP server 启动与调用挂接 `mcp.use` 权限。
2. 为 extension 执行挂接 `extension.execute` 权限。
3. 明确 PI 返回允许但 workflow 未授权时，以 workflow 侧拒绝为准。

### 第 7 步：审计与 CLI

1. 实现安全决策审计记录。
2. CLI 增加 `policy` 查看/校验能力。
3. 为 `trace` / `inspect` 预留安全事件展示入口。

### 第 8 步：PI 生态能力适配

1. 调研并优先接入 `pi.dev/packages` 中已验证的权限/信任/策略包。
2. 对可直接复用的能力做 adapter 封装。
3. 仅对 PI 未覆盖的 workflow 语义层部分补自定义实现。

### 第 9 步：集成测试与文档同步

1. 完成权限声明、越权阻断、降权继承、审计记录的集成测试。
2. 同步总计划、架构文档与 CLI 帮助文案。

## 8. 测试与验收

### 单元测试覆盖

| 模块 | 最低用例数 | 覆盖场景 |
|---|---|---|
| security/resolver | 12 | 默认权限、节点覆盖、父子交集、agent 降权、workflow-tool 降权 |
| security/validator | 12 | 缺失声明、越权声明、静态冲突、高风险节点未授权 |
| security/auditor | 6 | allow 记录、deny 记录、原因格式、上下文字段完整 |
| adapters/pi/permission-bridge | 8 | PI allow、PI deny、workflow allow、workflow deny、合并判定 |
| executors 安全接入 | 10 | agent/tool/http/workflow-tool/MCP/extension 权限拦截 |
| CLI policy | 4 | 查看、校验、错误输出、TOML 加载 |

### 验收标准

1. [ ] `WorkflowConfig.security` 可通过 JSON/TOML 正确加载。
2. [ ] 高风险能力在未授权时默认被阻止执行。
3. [ ] 子 workflow、workflow tool、agent 节点不能静默提权。
4. [ ] 第三方 extension/tool 需同时满足 PI 侧结果与 workflow 侧授权。
5. [ ] MCP、文件、网络、命令执行等权限可被统一声明和校验。
6. [ ] 运行前预检可拦截明显越权与缺失授权场景。
7. [ ] 权限拒绝会形成可审计记录与清晰错误。
8. [ ] 优先接入至少一类 PI 生态内已验证的权限/策略能力。
9. [ ] 所有新增测试通过，且不影响现有测试基线。

## 9. 风险与依赖

- 风险 1：PI 已验证权限包的接口形态可能与 workflow 语义层不完全一致，需要 adapter 映射。
- 风险 2：安全策略如果过度前置，容易与阶段 9-10 已有桥接逻辑重复，需要严格保持边界。
- 风险 3：权限粒度过粗会影响可用性，粒度过细会导致配置复杂度失控。
- 依赖 1：阶段 9 的信任模型与基于 PI 的 extension 桥接稳定。
- 依赖 2：阶段 10 的 workflow tool、命名智能体与子运行链路稳定。
- 依赖 3：PI 生态内存在可复用且验证过的权限/策略相关包或机制。

## 10. 完成定义（DoD）

- [x] workflow 级安全策略模型完成。
- [x] 权限解析、传播、降权规则完成。
- [x] 运行前安全预检完成。
- [x] 执行链路权限判定与拒绝逻辑完成。
- [x] 安全审计记录与 CLI policy 能力完成。
- [x] 至少接入一项 PI 生态内已验证能力并形成适配方案。
- [x] 相关测试、计划索引与文档同步完成。

## 11. 验收结论

- 验收时间：
- 技术栈：TypeScript、Node.js、Vitest、CLI
- 目标完成情况：
  - [x] 安全配置完成
  - [x] 权限模型完成
  - [x] 预检完成
  - [x] 执行判定完成
  - [x] 审计完成
  - [x] PI 生态适配完成
- 非功能检查：`packages/pi-workflow` 与 `pi-workflow-cli` build 通过；阶段 11 相关 core 测试、CLI policy 测试通过。
- 最终判定：主链路完成（后续仍可继续细化权限 scope 与可视化表现）
- 遗留事项：
  - 将 `PiPermissionBridge` 进一步对接到真实 PI 侧权限/信任结果，而不仅是宿主可选回调
  - 细化 extension / MCP / 资源作用域与 workflow 侧 scope 的映射规则
  - 补充更多端到端测试，覆盖 trace/inspect 中的安全事件展示
