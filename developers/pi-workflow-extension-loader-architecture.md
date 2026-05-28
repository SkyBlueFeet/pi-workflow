---
- 版本锚点
- 创建时间：2026-05-26 23:50 +08:00
- 最后更新：2026-05-26 23:50 +08:00
- 代码快照日期：2026-05-26
- 关联计划：`PLANS/pi-workflow-phases/PLAN_PHASE-9-5_PI-EXTENSION-BRIDGE.md`
---

# Pi Workflow Extension Loader 架构设计

> `@pi-workflow/extension-loader` 是 PI 生态扩展包在 headless 运行时的兼容层。它以独立包形式存在，不向 `@pi-workflow/core` 引入任何运行时依赖。

---

## 1. 设计动机

### 1.1 问题

PI coding agent 的 extension 机制基于 `ExtensionAPI` 接口——每个 extension 包导出一个 default 函数，接收 `ExtensionAPI` 对象并调用 `pi.registerTool()` 等方法来声明能力。这些方法依赖完整的 PI 运行时环境（TUI、Session 生命周期、事件总线等）。pi-workflow 运行在 headless CLI 环境，没有这些设施。

### 1.2 目标

在不修改 PI extension 包的前提下，使它们能在 headless 环境中被加载并使用其注册的工具。对无法工作于 headless 的扩展（如依赖 TUI 交互），为后续原生实现预留扩展点。

### 1.3 原则

1. **核心零膨胀**：`@pi-workflow/core` 不感知扩展加载逻辑，不增加运行时依赖。
2. **兼容优先**：复用 PI 生态的 `ExtensionAPI` 接口定义，不发明新协议。
3. **优雅降级**：单个扩展加载失败不影响全局；UI 依赖的工具执行时返回明确错误而非崩溃。
4. **按需加载**：仅在 `--pi-extensions` 标记下触发 node_modules 扫描。

---

## 2. 包结构

```
packages/pi-extension-loader/
├── package.json              # @pi-workflow/extension-loader
├── tsconfig.build.json
├── vitest.config.ts          （可选）
└── src/
    ├── index.ts              # 公开 API 导出
    ├── headless-extension-api.ts  # ExtensionAPI 最小桩
    └── pi-extension-bridge.ts     # 加载管线 + 工具桥接
```

---

## 3. 核心模块

### 3.1 HeadlessExtensionAPI

**职责**：实现 `ExtensionAPI` 接口的最小可运行子集，使 extension 在无 PI 运行时的情况下能完成初始化。

**实现的接口方法**（来自 `@earendil-works/pi-coding-agent`）：

| 方法 | 行为 |
|---|---|
| `registerTool(def)` | 将工具定义存入 `this.tools[]` |
| `getAllTools()` | 返回 `this.tools` 的浅拷贝 |
| `on(event, handler)` | 空实现（不记录 handler） |
| `registerCommand()` | 空实现 |
| `registerShortcut()` | 空实现 |
| `registerFlag()` | 空实现 |
| `getFlag()` | 返回 `undefined` |
| `registerProvider()` | 空实现 |
| `registerMessageRenderer()` | 空实现 |
| `sendMessage()` | 空实现 |
| `sendUserMessage()` | 空实现 |
| `appendEntry()` | 空实现 |
| `setSessionName()` | 空实现 |
| `getSessionName()` | 返回 `undefined` |
| `setLabel()` | 空实现 |
| `exec()` | 返回空结果 `{ exitCode: 0, stdout: "", stderr: "" }` |
| `getActiveTools()` | 返回 `[]` |
| `setActiveTools()` | 空实现 |
| `getCommands()` | 返回 `[]` |
| `setModel()` | 返回 `false` |
| `getThinkingLevel()` | 返回 `"none"` |
| `setThinkingLevel()` | 空实现 |
| `unregisterProvider()` | 空实现 |
| `events` | 返回含空 `emit` 和 `on` 的对象 |

**设计依据**：extension 在 init 阶段只用到 `registerTool`、`registerCommand`、`registerShortcut`、`registerFlag`、`on`、`getAllTools`、`getFlag`。其余方法只在 runtime 阶段被调用，headless 模式下无对应场景。

### 3.2 PiExtensionBridge

**职责**：封装扩展发现的完整管线——从 node_modules 扫描到工具适配。

```
loadFromNodeModules()
  → scanNodeModules()     # 遍历候选包名，检查 package.json 中 pi.extensions
  → loadFromPackages()    # 对每个包执行 loadSingle()
      → loadSingle(pkg)   # 动态 import() → new HeadlessExtensionAPI → mod.default(api)
      → bridgeTool(def)   # 包装 execute + 参数适配 → ExtensionTool
  → collect LoadedExtension[]
```

#### 3.2.1 扫描策略

`scanNodeModules()` 维护一个候选包白名单（`["pi-web-access", "pi-mcp-adapter", "@juicesharp/rpiv-ask-user-question"]`），对每个候选执行动态 `import("{name}/package.json")`，检查是否包含 `pi.extensions` 字段。不存在的包被 try/catch 静默跳过。

这一策略的局限：
- 仅扫描白名单包，非自动发现
- 依赖 `package.json` 可被 `import()` 解析（ESM require 风格）

#### 3.2.2 工具桥接

`bridgeTool()` 将捕获的 `ToolDefinition` 转换为 `ExtensionTool`：

```typescript
interface ExtensionTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}
```

转换要点：
- 新 `execute` 包装原 `tool.execute(toolCallId, params, signal, onUpdate, ctx)`，传入 `{ hasUI: false }` 上下文
- 原 execute 的返回值（`{ content: [{ type: "text", text }], details }`）被扁平化为 `{ content: text, isError: false }`
- 异常被捕获为 `{ content: errorMessage, isError: true }`
- 所有非工具注册的 ExtensionAPI 调用在初始化阶段被静默忽略

---

## 4. 与核心包的数据通道

### 4.1 设计原则

核心包不直接 import `@pi-workflow/extension-loader`。数据通过两个可选字段传递：

```typescript
// ① 请求级别：Agent 节点每次执行时可附带工具的 execute 函数
interface WorkflowAgentRequest {
  readonly toolExecutors?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
}

// ② 宿主级别：PiHostAdapter 构造时可注入全局扩展工具
interface PiHostAdapterOptions {
  readonly extensionTools?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
}
```

### 4.2 合并逻辑

`PiHostAdapter.runAgent()` 中的合并顺序：

```
request.toolExecutors → 每个 request.tools[i] 的 execute 优先
  ↓ (merge)
options.extensionTools → 没有对应 request.tools 的扩展工具额外加入 agent 工具列表
```

即：
- `request.tools` 中的工具如果有同名 executor，使用 executor 代替 stub
- `options.extensionTools` 中没有出现在 `request.tools` 中的，自动注册为额外 agent 工具

### 4.3 调用路径

```
CLI run.ts:
  PiExtensionBridge.loadFromNodeModules() → ExtensionTool[]
  new PiHostAdapter({ extensionTools: bridge.getAllTools() })

PiHostAdapter.runAgent(request):
  agentTools = [
    ...request.tools.map(t → toAgentTool(t, executorFrom(t.name))),
    ...extensionTools.filter(t → not in request.tools).map(t → toAgentToolDirect(t)),
  ]
  Agent({ initialState: { tools: agentTools } })
```

---

## 5. CLI 集成

### 5.1 标记

| 标记 | 作用 |
|---|---|
| `--pi` | 使用真实 PiHostAdapter（必须，否则使用 Mock） |
| `--pi-extensions` | 启用扩展扫描（`--pi` 时自动开启） |

### 5.2 行为

1. 解析 CLI 参数，检测 `--pi` 或 `--pi-extensions`
2. 若启用，动态 import `@pi-workflow/extension-loader`
3. 调用 `PiExtensionBridge.loadFromNodeModules()`
4. 通过 `bridge.getAllTools()` 获取所有成功加载的工具
5. `new PiHostAdapter({ extensionTools })` 注入
6. 加载日志输出到 stderr（debug 模式展示各包加载结果）

### 5.3 错误处理

- `@pi-workflow/extension-loader` 不可用时（未安装）：catch 错误，静默跳过
- 单个 extension 加载失败：`loadFromNodeModules` 返回含 `error` 字段的 `LoadedExtension`
- 无 extension 安装：返回空列表，正常执行

---

## 6. 边界与约束

### 6.1 已知不工作的场景

| 场景 | 原因 |
|---|---|
| extension 在 `session_start` 中初始化状态 | headless 无 session 生命周期事件 |
| extension 依赖 `ctx.ui.custom()` | headless 无 TUI 渲染引擎 |
| extension 依赖 `@mariozechner/*` 命名空间 | 该命名空间未安装 |
| pnpm strict 模式下的 node_modules | `import()` 无法寻址 hoisted 包 |

### 6.2 未来扩展点

- `PiExtensionBridge.loadSingle()` 可被子类重写以支持非标准加载策略
- `HeadlessExtensionAPI` 可被子类扩展以支持特定场景（如记录命令注册用于 CLI 帮助）
- `bridgeTool()` 的上下文 `{ hasUI: false }` 可在未来改为配置项

---

## 7. 依赖关系

```
@pi-workflow/extension-loader
  ├── @pi-workflow/core          # workspace *, 仅用于编译时类型一致性
  └── @earendil-works/pi-coding-agent  # devDep, 仅用于类型引用

apps/pi-workflow-cli
  ├── @pi-workflow/core           # workspace *
  ├── @pi-workflow/extension-loader  # workspace *（运行时动态 import）
  └── ...
```

无传递运行时依赖增加。

---

## 8. 测试策略

### 8.1 单元测试

| 模块 | 场景 |
|---|---|
| `HeadlessExtensionAPI` | registerTool 捕获、空实现不抛异常、events.emit 不抛异常 |
| `PiExtensionBridge` | loadFromPackages 成功/失败、bridgeTool 包装、异常传递 |
| `PiHostAdapter` | toAgentTool 优先 executor、toAgentToolDirect 创建额外工具 |

### 8.2 集成测试

- 安装 pi-mcp-adapter → `--pi-extensions` 加载 → 验证 direct tools 可调用
- 无 extension → `--pi-extensions` 无报错

### 8.3 回归测试

- 已有 146 项测试维持全通过
- 无 extension 时 `PiHostAdapter.runAgent()` 行为不变
