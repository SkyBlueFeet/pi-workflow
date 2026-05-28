---
**版本锚点**
- 创建时间：2026-05-26 23:10 +08:00
- 最后更新：2026-05-26 23:50 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 9.5：PI 扩展桥接

> 本阶段是阶段 9（PI 生态集成）的延伸，解决"如何将 PI 生态中的现有 extension 包（通过 npm 安装）集成到 pi-workflow 的 headless 运行时中"的问题。

---

## 1. 背景与目标

### 背景

阶段 9 已完成 PI 包管理的基础设施（TOML 配置、包安装器、Manifest 解析、信任模型、资源加载），但 `PiHostAdapter` 只使用了底层 `@earendil-works/pi-agent-core` 的 `Agent` 类，没有加载 PI extension 的能力。

PI 社区已有成熟的 extension 包（如 `pi-web-access`、`pi-mcp-adapter`、`@juicesharp/rpiv-ask-user-question`），它们通过 `pi.registerTool()` 向 PI Agent 注册工具。pi-workflow 需要在 headless/CLI 模式下也能加载这些 extension，将其工具纳入 agent 可调用工具列表。

### 目标

1. 新建独立包 `packages/pi-extension-loader`，提供 PI extension 兼容层。
2. 提供最小 `ExtensionAPI` 桩，在不依赖 PI 完整运行时的情况下加载 extension 并捕获其注册的工具。
3. 将捕获的工具桥接为 agent 可调用的 execute 函数，通过 `PiHostAdapter` 注入。
4. **核心包零膨胀**：`packages/pi-workflow` 不直接感知 PI extension 加载逻辑，仅通过可选的 `toolExecutors` 数据接口传递。
5. CLI `--pi-extensions` 标记控制是否启用扩展扫描与加载。

### 范围

- 新建 `packages/pi-extension-loader`
- `HeadlessExtensionAPI` — ExtensionAPI 最小桩（20+ 方法空实现，仅 `registerTool` 捕获）
- `PiExtensionBridge` — 扫描 node_modules → import default → 捕获工具 → 适配为可调用工具
- 核心 `WorkflowAgentRequest.toolExecutors?` + `PiHostAdapterOptions.extensionTools?`
- CLI `--pi-extensions`

### 非目标

- 不安装任何 PI extension npm 包（已有三个候选包均因 TUI/运行时依赖不满足 headless 要求）
- 不实现任何原生工具（`ask_user_question` stdin 等）
- 不集成 `pi-subagents`（推后处理）
- 不提供完整的 PI TUI/交互模式模拟
- 不替换 `PiHostAdapter` 的现有 agent 执行引擎
- 不需要阶段 9 之外的新包管理系统

---

## 2. 架构设计

### 2.1 分层架构

```
┌─ CLI 层 (apps/pi-workflow-cli) ───────────────────────────┐
│  run.ts                                                    │
│  --pi-extensions → PiExtensionBridge.loadFromNodeModules() │
│  → ExtensionTool[] → new PiHostAdapter({ extensionTools }) │
└──────────────────────────┬───────────────────────────────-┘
                           │ ExtensionTool[]（execute 已桥接）
                           ▼
┌─ 宿主层 (packages/pi-workflow) ──────────────────────────-┐
│  PiHostAdapter                                             │
│  options.extensionTools → 合并到 agent.tools                │
│  toAgentTool(ref, executor) → 优先使用 executor              │
└────────────────────────────────────────────────────────────┘
                           ▲
                           │ ExtensionAPI 桩 + import()
┌─ 兼容层 (packages/pi-extension-loader) ───────────────────-┐
│  PiExtensionBridge                                         │
│  1. scanNodeModules() → 查找含 pi.extensions 的包           │
│  2. loadSingle(pkg) → import default + HeadlessExtensionAPI│
│  3. bridgeTool(capturedTool) → ExtensionTool               │
│                                                            │
│  HeadlessExtensionAPI                                      │
│  - registerTool → this.tools.push(def)                     │
│  - 其余方法全部空实现                                       │
└────────────────────────────────────────────────────────────┘
```

### 2.2 关键数据流

```
用户安装 pi-xxx (npm install pi-xxx)
  → npm 将包放入 node_modules
  → pi-workflow run --pi --pi-extensions
    → PiExtensionBridge.scanNodeModules()
      → import("pi-xxx/package.json") 检查 pi.extensions
      → import("pi-xxx") 获取 default export
        → mod.default(api: HeadlessExtensionAPI)
          → api.registerTool({ name, description, parameters, execute })
          → HeadlessExtensionAPI.tools.push(def)
      → bridgeTool(def) → ExtensionTool
        → 包装 execute，传递 { hasUI: false }
    → bridge.getAllTools() → ExtensionTool[]
    → new PiHostAdapter({ extensionTools })
      → runAgent() 时将 ExtensionTool 合并为 agent tool
```

### 2.3 核心接口

```typescript
// 包对外暴露的加载结果
interface ExtensionTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }>;
}

// PiExtensionBridge
class PiExtensionBridge {
  loadFromNodeModules(): Promise<LoadedExtension[]>;
  loadFromPackages(packages: string[]): Promise<LoadedExtension[]>;
  getAllTools(): ExtensionTool[];
}

// HeadlessExtensionAPI（供 extension 内部调用）
class HeadlessExtensionAPI {
  tools: ToolDefinition[];
  registerTool(def: ToolDefinition): void;
  // 其余 ExtensionAPI 方法全部空实现
}

// 核心数据通道（WorkflowAgentRequest 新增，零依赖增加）
interface WorkflowAgentRequest {
  // ...
  readonly toolExecutors?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
}

// PiHostAdapter 构造器（接收扩展工具）
interface PiHostAdapterOptions {
  // ...
  readonly extensionTools?: ReadonlyArray<{
    readonly name: string;
    readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }>;
}
```

---

## 3. 实现结果

### 3.1 已交付

| 交付项 | 状态 | 文件 |
|---|---|---|
| `packages/pi-extension-loader` 包结构 | ✅ | `package.json`, `tsconfig.build.json` |
| `HeadlessExtensionAPI` | ✅ | `src/headless-extension-api.ts` |
| `PiExtensionBridge` | ✅ | `src/pi-extension-bridge.ts` |
| 公开导出 | ✅ | `src/index.ts` |
| `WorkflowAgentRequest.toolExecutors?` | ✅ | `packages/pi-workflow/src/adapters/pi/types.ts` |
| `PiHostAdapterOptions.extensionTools?` | ✅ | `packages/pi-workflow/src/adapters/pi/pi-host-adapter.ts` |
| `toAgentTool(ref, executor?)` — 优先 executor | ✅ | 同上 |
| `toAgentToolDirect(ext)` — 无对应 WorkflowToolRefIR 的扩展工具 | ✅ | 同上 |
| CLI `--pi-extensions` 集成 | ✅ | `apps/pi-workflow-cli/src/commands/run.ts` |
| CLI 帮助文档 | ✅ | `apps/pi-workflow-cli/src/cli.ts` |
| 注册到 workspace | ✅ | 根 `package.json` workspaces |

### 3.2 已验证

- 三包构建通过：`@pi-workflow/core`、`@pi-workflow/extension-loader`、`pi-workflow-cli`
- 146 项已有测试 0 回归
- 无 extension 安装时 `--pi-extensions` 无报错，只打印 debug 日志

### 3.3 PI 扩展包评估结论

| 包 | 版本 | 问题 | 结论 |
|---|---|---|---|
| `pi-web-access` | 0.10.7 | 值级 import `@mariozechner/pi-tui`，命名空间不存在 | 不集成 |
| `pi-mcp-adapter` | 2.8.0 | tool execute 依赖 `session_start` 事件初始化 state | 不集成 |
| `@juicesharp/rpiv-ask-user-question` | 1.13.0 | execute 依赖 `ctx.ui.custom()` TUI 交互 | 不集成 |

---

## 4. 使用方式

```bash
# 用户自行安装 PI extension
npm install pi-mcp-adapter

# 运行并加载扩展工具
pi-workflow run workflow.json --pi --pi-extensions

# --pi 自动启用 --pi-extensions（无需单独传）
pi-workflow run workflow.json --pi
```

---

## 5. 风险与约束

- 加载的 extension 在 `ctx.hasUI = false` 环境下运行，工具若依赖 UI 会返回错误或被跳过
- `scanNodeModules()` 依赖 node_modules 可解析性，对于 pnpm 严格模式或打包后部署可能不适用
- 扩展包加载失败不影响主流程，仅记录 warning
- 核心包改动仅限于数据接口（可选字段），无运行时依赖增加

---

## 6. 完成定义（DoD）

- [x] `packages/pi-extension-loader` 包结构创建
- [x] `HeadlessExtensionAPI` 最小桩
- [x] `PiExtensionBridge` 实现
- [x] 核心 `WorkflowAgentRequest.toolExecutors` + `PiHostAdapterOptions.extensionTools`
- [x] `PiHostAdapter` 合并扩展工具到 agent tool 列表
- [x] CLI `--pi-extensions` 集成
- [x] 三包构建通过 + 146 测试 0 回归
- [ ] 单元测试覆盖 `HeadlessExtensionAPI` + `PiExtensionBridge`

---

## 7. 验收结论

- 验收时间：
- 技术栈：TypeScript、Node.js、Vitest
- 目标完成情况：
  - [x] Extension 桥接兼容层
  - [x] 核心接口 minimal 扩展（可选字段，零依赖增加）
  - [x] CLI 集成
  - [x] 构建 + 测试无回归
  - [ ] 单元测试
- 最终判定：进行中
- 遗留事项：
  - 三个 PI extension 包因 TUI 依赖暂不集成
  - 后续如有 headless-first extension 出现，可直接通过本桥接层加载
  - 单元测试待补充
