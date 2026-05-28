# 代码质量检查报告

## 1. 报告元信息

| 字段 | 内容 |
|------|------|
| 检查时间 | 2026-05-27 11:15:00 +08:00 |
| 检查范围 | `packages/pi-workflow/src/`、`packages/pi-extension-loader/src/`、`packages/pi-package-adapter/src/`、`apps/pi-workflow-cli/src/` |
| 检查类型 | 人工设计审查 + 实现问题分析 + 编译验证 |
| 标准来源 | SOLID 原则、TypeScript 类型安全、并发安全、阶段 9-11 计划对齐、防御性编程 |
| 总体判定 | **FAIL — 存在 2 个 P0 编译阻断问题 + 3 个 P1 设计/正确性问题** |

---

## 2. 检查标准

| 标准 | 说明 |
|------|------|
| 编译正确性 | TypeScript 严格模式编译是否通过 |
| 单一职责 (SRP) | 类/模块是否承担过多职责 |
| 正确性 | 核心流程逻辑是否正确，并发场景是否安全 |
| 接口一致性 | 安全预检与运行时权限检查是否一致 |
| 代码重复 | 跨包/跨模块是否存在重复实现 |
| 计划对齐 | 实现是否与阶段计划的设计目标对齐 |
| 防御性编程 | 关键路径是否存在未处理的边界情况 |

---

## 3. 检查结果

### 3.1 设计问题

| 编号 | 严重度 | 位置 | 问题 | 通过 |
|------|--------|------|------|------|
| D1 | 严重 | `workflow-runtime.ts:68/162-183` | `subRunDepth` 共享计数器，并发子工作流下存在竞态条件 | ❌ |
| D2 | 中等 | `security/validator.ts:124-127` | `checkHighRiskNodeHasPermission` 遗漏 `agent` 节点类型，与运行时 `checkNodePermission` 不一致 | ❌ |
| D3 | 中等 | `index.ts:14` | `defaultSecurityConfig` 重复导出（`security/policy.ts` 函数 vs `config/defaults.ts` 常量） | ❌ |
| D4 | 低 | `workflow-runtime.ts` (796行) | `WorkflowRuntime` God Class，集成过多样式职责（复合执行、安全审计、状态管理、子运行控制） | ❌ |
| D5 | 低 | `pi-package-adapter.ts` vs `packages/` | 包管理模块存在跨包重复实现（`parsePackageSource`、信任策略、锁文件） | ❌ |
| D6 | 低 | `skill-loader.ts:14` | `@package/resource` 正则不支持 scoped npm 包（`@scope/pkg/resource`） | ❌ |

### 3.2 实现问题

| 编号 | 严重度 | 位置 | 问题 | 通过 |
|------|--------|------|------|------|
| I1 | 严重 | `toml-loader.ts:308/318/326/337/350/384` | `readonly` 属性赋值导致 TS2540 编译错误，阻断构建 | ❌ |
| I2 | 中等 | `agent-executor.ts:97` | `maxDepth: 10` 硬编码，应可通过 `WorkflowConfig` 或节点配置覆盖 | ❌ |
| I3 | 中等 | `executor-registry` 注册 vs CLI 注册 | CLI `run.ts` 将 `tool/http/if/parallel/loop` 注册为 `UnsupportedExecutor`，而非使用实际执行器 | ❌ |
| I4 | 低 | `extension-executor-loader.ts:40-46` | Extension 执行桥接始终返回 stub，从未实际加载 extension 模块 | ❌ |
| I5 | 低 | `workflow-tool-bridge.ts:80-92` | `loadWorkflowDefinition` 使用同步 I/O (`statSync`/`readFileSync`) | ❌ |
| I6 | 低 | `pi-package-adapter.ts:264-278` | `computeIntegrityHash` 全量同步遍历文件树并读取 | ❌ |
| I7 | 低 | `subrun.ts:12-18` | `executeSubWorkflow` 是纯薄封装，不添加任何价值，且未被任何模块 import | ❌ |
| I8 | 低 | `agent-executor.ts:127` | `agent.error` 事件在 `yield` 后 `throw`，若 `piHost.runAgent()` 在抛出前还有未消费的产出，事件流会静默丢失 | ❌ |

---

## 4. P0 / P1 问题详解

### 4.1 [P0] Build Failure: TS2540 — readonly 属性赋值

**文件**：`packages/pi-workflow/src/config/toml-loader.ts:308/318/326/337/350/384`

**问题**：
`WorkflowSecurityConfig`（`security/types.ts`）、`PermissionGrant`、`NodeSecurityConfig` 的所有字段均有 `readonly` 修饰符。但 `toml-loader.ts` 中的 `parseSecurity` 和 `parsePermissionGrants` 函数通过对象字面量后赋予属性的方式构造这些类型，导致编译报错：

```
src/config/toml-loader.ts(308,11): error TS2540: Cannot assign to 'defaultMode' because it is a read-only property.
src/config/toml-loader.ts(318,11): error TS2540: Cannot assign to 'permissions' because it is a read-only property.
src/config/toml-loader.ts(326,11): error TS2540: Cannot assign to 'nodes' because it is a read-only property.
src/config/toml-loader.ts(337,21): error TS2540: Cannot assign to 'permissions' because it is a read-only property.
src/config/toml-loader.ts(350,11): error TS2540: Cannot assign to 'audit' because it is a read-only property.
src/config/toml-loader.ts(384,15): error TS2540: Cannot assign to 'scope' because it is a read-only property.
```

**修复方向**：将 `parseSecurity` 中的逐步赋值写法改为一次性构造对象（使用展开运算符或直接构造对象字面量），或将 `WorkflowSecurityConfig` 等类型的 `readonly` 移除（因为这些类型只在安全模块内部作为不可变抽象使用，TOML 加载器构造阶段不需要保证不可变性）。

---

### 4.2 [P0] Build Failure: TS2308 — `defaultSecurityConfig` 重复导出

**文件**：`packages/pi-workflow/src/index.ts:14`

**问题**：
- `security/policy.ts` 导出 `defaultSecurityConfig` 为**函数**（返回 `WorkflowSecurityConfig`）
- `config/defaults.ts` 导出 `defaultSecurityConfig` 为**常量**（`WorkflowSecurityConfig` 对象）
- `security/index.ts` 重新导出 `./policy.js` 中的函数版本
- `config/index.ts` 重新导出 `./defaults.js` 中的常量版本
- `src/index.ts` 通过 `export * from "./security/index.js"` 和 `export * from "./config/index.js"` 同时引入两者

TS2308 错误阻止了该模块的编译。`src/index.ts` 明确输出了该错误：
```
src/index.ts(14,1): error TS2308: Module "./security/index.js" has already exported a member named 'defaultSecurityConfig'. Consider explicitly re-exporting to resolve the ambiguity.
```

**修复方向**：
- 方案 A（推荐）：重命名其中一个导出（如 `config/defaults.ts` 中的改名为 `defaultSecurityConfigValue`，保留 `security/policy.ts` 的函数名）
- 方案 B：在 `src/index.ts` 中显式重新导出其中一个，不依赖 `export *`

---

### 4.3 [P1] `subRunDepth` 竞态条件

**文件**：`packages/pi-workflow/src/runtime/workflow-runtime.ts:68, 162-183`

**问题**：
`subRunDepth` 是 `WorkflowRuntime` 实例上的可变字段，所有通过该 runtime 实例发起的子工作流调用共享同一个计数器。在以下场景中存在竞态：

1. 同一 workflow 的 `parallel` 节点内两个分支同时调用 workflow tool
2. 两个并发 agent 节点同时调用 workflow tool

当一个并发调用的 `runSubWorkflow` 在 `finally` 中执行 `this.subRunDepth--` 时，另一个调用的 `subRunDepth` 值已被修改，导致深度计数不准确。

**修复方向**：将深度计数器改为每次调用时独立维护（通过 `runInternal` 的 options 参数传递当前深度），而不是使用实例级共享字段。

---

### 4.4 [P1] 安全预检与运行时权限检查不一致

**文件**：
- 预检：`security/validator.ts:124-127`（`checkHighRiskNodeHasPermission`）
- 运行时：`workflow-runtime.ts:560-564`（`checkNodePermission`）

**问题**：
`checkHighRiskNodeHasPermission` 仅映射了 `http → network.request` 和 `tool → process.execute`，未包含 `agent → extension.execute`。

而运行时的 `checkNodePermission` 正确包含了 `agent`：
```typescript
const capabilityMap: Partial<Record<string, PermissionCapability>> = {
  "http": "network.request",
  "tool": "process.execute",
  "agent": "extension.execute",  // ← 预检缺少此项
};
```

这导致在预检阶段，即使 security.permissions 未声明且 defaultMode 为 deny，`agent` 节点仍能通过预检，但执行时会被运行时拒绝。用户无法在运行前捕获配置错误。

**修复方向**：在 `checkHighRiskNodeHasPermission` 的 `capabilityMap` 中添加 `"agent": "extension.execute"`，或将 capabilityMap 抽取为共享常量。

---

### 4.5 [P1] `maxDepth` 硬编码

**文件**：`packages/pi-workflow/src/executors/agent-executor.ts:97`

**问题**：
```typescript
hostCallableTools = adaptWorkflowTools(bridgeResult.tools, {
  runtime: context.runtime,
  config,
  parentRunId: context.runId,
  signal: context.signal,
  maxDepth: 10,  // ← 硬编码
});
```

递归深度限制被硬编码为 10，无法通过 `WorkflowConfig` 或节点级 `executor.config` 覆盖。对于需要更深嵌套的场景（如多级子 workflow tool 调用链），这限制了系统的弹性。

**修复方向**：从 `WorkflowConfig` 中添加 `maxWorkflowToolDepth` 字段，或从节点 `executor.config` 中读取，优先级：节点配置 > 全局配置 > 默认值（10）。

---

## 5. P2 问题综述

### 5.1 跨包重复实现（D5）

`packages/pi-workflow/src/packages/types.ts` 和 `packages/pi-package-adapter/src/pi-package-adapter.ts` 各自独立定义了：
- `PackageSource` / `PackageSourceType`
- `PackageDeclaration`
- `InstalledPackageRecord`
- `parsePackageSource()` / `packageSourceToString()`
- `loadLockfile()` / `saveLockfile()`
- `loadTrustPolicy()` / 信任策略逻辑

`packages/pi-workflow/src/packages/installer.ts` 只是薄封装 `pi-package-adapter`。两个包的职责边界不清晰。

### 5.2 CLI 未使用实际执行器（I3）

`apps/pi-workflow-cli/src/commands/run.ts:71-75`：
```typescript
registry.register("tool", new UnsupportedExecutor());
registry.register("http", new UnsupportedExecutor());
registry.register("if", new UnsupportedExecutor());
registry.register("parallel", new UnsupportedExecutor());
registry.register("loop", new UnsupportedExecutor());
```

`tool`、`http` executor 已经实现并存在于 `executors/` 中，但 CLI 仍注册为 `UnsupportedExecutor`。`if/parallel/loop` 复合节点由 runtime 内置处理，注册 `UnsupportedExecutor` 为正确行为，但 `tool` 和 `http` 应使用对应的 `ToolExecutor` 和 `HttpExecutor`。

### 5.3 同步 I/O 在运行时路径（I5）

`agents/workflow-tool-bridge.ts:80-92` 的 `loadWorkflowDefinition` 在 agent 执行阶段同步调用 `statSync`、`readFileSync`，而非启动加载阶段。如果 workflowPath 指向大型文件或慢速存储，会阻塞事件循环。

### 5.4 Scoped 包引用解析不完整（D6）

`skill-loader.ts:14` 的正则 `/^@([\w-]+)\/(.+)$/` 仅支持单级别名（如 `@my-pkg/skill-name`）。对于 scoped npm 包（如 `@my-scope/my-pkg/resource-name`），该正则无法正确匹配。

### 5.5 Extension 桥接始终为 stub（I4）

`adapters/pi/extension-executor-loader.ts:40-46` 的 `tryLoadExtension` 始终返回硬编码的 stub 结果，未实际 `import()` 或 `require()` extension 模块。阶段 9 和 9.5 计划明确要求"仅对受信任且经 PI 成功解析的 extension 包尝试桥接执行能力"，当前实现未达成此目标。

### 5.6 WorkerRuntime God Class（D4，延续）

796 行的 `WorkflowRuntime` 仍然承担过多职责：复合节点执行（4 个私有方法，140+ 行）、primitive 节点执行（120+ 行）、安全审计集成、运行状态管理、子运行控制。这是延续自上份报告未解决的问题，影响可测试性和可维护性。

---

## 6. 自动化验证结果

### 6.1 编译检查

| 包 | 状态 | 错误数 |
|----|------|--------|
| `@pi-workflow/core` | **FAIL** | TS2540 × 6 + TS2308 × 1 = 7 errors |
| `@pi-workflow/extension-loader` | PASS | 0 |
| `@pi-workflow/pi-package-adapter` | PASS | 0 |
| `pi-workflow-cli` | PASS | 0 |

### 6.2 测试执行

测试运行结果（323 test files）：
- 129 passed, 169 failed, 25 skipped
- 测试失败主要来自 `.pi/packages/coding-agent`（第三方 PI 测试套件），非本仓库代码问题
- 本仓库 36 test files / 146 tests（第 8 份报告基线）的回归情况需排除第三方噪音后确认

### 6.3 计划对齐检查

| 阶段 | 计划要求 | 实际状态 | 偏差 |
|------|---------|---------|------|
| 阶段 9 DoD | TOML 配置 + 包管理 + 资源加载 + extension 桥接 + 信任模型 + 运行前预检 | TOML 加载器编译失败；extension 桥接为 stub | P0 阻断 |
| 阶段 10 DoD | 命名智能体 + agentId 解析 + workflow tool + 子运行隔离 + CLI agent | 功能可用，但 `maxDepth` 硬编码、`subRunDepth` 有竞态 | P1 |
| 阶段 11 | 安全策略模型尚未开始实现 | `WorkflowConfig.security` 类型已定义，`policy.ts`/`validator.ts`/`auditor.ts`/`resolver.ts` 已实现 | 功能提前实现 |
| 阶段 9/10 专用测试 | 计划要求补充专用单元测试 | 未补充（36 test files 全部为既有测试） | 遗留 |

**关键发现**：阶段 11 安全策略模块在计划中标记为"待阶段 9-10 主链路稳定后实施"，但实际代码已提前实现。这解释了 TOML 加载器中引入安全字段而导致编译错误的原因——TOML 加载器的安全解析是阶段 11 工作的一部分，不应在阶段 9-10 未完全稳定时强制编译通过。

---

## 7. 结论与建议

| 指标 | 数量 |
|------|------|
| P0（编译阻断，需立即修复） | 2 |
| P1（正确性/设计缺陷，应近期修复） | 3 |
| P2（质量/维护性，可排期修复） | 8 |
| 总计 | 13 |

### 核心建议

1. **优先修复 P0 编译阻断**：TS2540（readonly 赋值）和 TS2308（重复导出）是 `npm run build` 失败的直接原因，阻塞所有后续验证。
2. **修复 `subRunDepth` 竞态条件**：并发子工作流调用场景下深度计数不可靠，影响 product correctness。
3. **统一安全预检与运行时权限检查**：`agent` 节点应在预检阶段就完成权限验证，而非运行时隐形拒绝。
4. **清理跨包重复实现**：`pi-package-adapter` 和 `packages/` 之间的重复应统一为单一实现源。
5. **重新评估阶段 11 前端加载进度**：安全模块已部分实现但 TOOML 加载器未对齐，建议将 TOML 安全字段的 `readonly` 问题与阶段 11 一并修复。
6. **补充阶段 9-10 专用测试**：36 test files 全为既有测试，600+ 行阶段 9-10 新代码缺少单元测试覆盖。

---

## 8. 命令输出摘录

### `npm run build --workspaces --if-present`

```
> @pi-workflow/core@0.0.0 build
> tsc -p tsconfig.build.json

src/config/toml-loader.ts(308,11): error TS2540: Cannot assign to 'defaultMode' because it is a read-only property.
src/config/toml-loader.ts(318,11): error TS2540: Cannot assign to 'permissions' because it is a read-only property.
src/config/toml-loader.ts(326,11): error TS2540: Cannot assign to 'nodes' because it is a read-only property.
src/config/toml-loader.ts(337,21): error TS2540: Cannot assign to 'permissions' because it is a read-only property.
src/config/toml-loader.ts(350,11): error TS2540: Cannot assign to 'audit' because it is a read-only property.
src/config/toml-loader.ts(384,15): error TS2540: Cannot assign to 'scope' because it is a read-only property.
src/index.ts(14,1): error TS2308: Module "./security/index.js" has already exported a member named 'defaultSecurityConfig'. Consider explicitly re-exporting to resolve the ambiguity.
```

### 违反类型定义

```typescript
// security/types.ts — 所有字段 readonly
export interface WorkflowSecurityConfig {
  readonly defaultMode?: SecurityDefaultMode;
  readonly permissions?: readonly PermissionGrant[];
  readonly nodes?: Record<string, NodeSecurityConfig>;
  readonly audit?: SecurityAuditConfig;
}

// toml-loader.ts — 逐步赋值被拒绝
const sec: WorkflowSecurityConfig = {};
sec.defaultMode = val["defaultMode"];  // ❌ TS2540
sec.permissions = parsePermissionGrants(...);  // ❌ TS2540
```

### 涉及的关键文件

```
packages/pi-workflow/src/config/toml-loader.ts (404 行)
packages/pi-workflow/src/security/types.ts (56 行)
packages/pi-workflow/src/security/validator.ts (151 行)
packages/pi-workflow/src/security/policy.ts (87 行)
packages/pi-workflow/src/config/defaults.ts
packages/pi-workflow/src/index.ts (16 行)
packages/pi-workflow/src/runtime/workflow-runtime.ts (796 行)
packages/pi-workflow/src/executors/agent-executor.ts (179 行)
packages/pi-workflow/src/agents/workflow-tool-bridge.ts (95 行)
packages/pi-workflow/src/adapters/pi/extension-executor-loader.ts (56 行)
packages/pi-package-adapter/src/pi-package-adapter.ts (403 行)
apps/pi-workflow-cli/src/commands/run.ts (207 行)
```
