---
**版本锚点**
- 创建时间：2026-05-30 12:51 +08:00
- 最后更新：2026-05-30 13:10 +08:00
- 阶段状态：已完成
- 代码快照日期：2026-05-30

---

# 阶段 13：PI 宿主工具与基础工具迁移

> 本阶段用于把“PI 宿主工具能力”从当前仅可被 `agent` 链路部分使用的状态，推进为 `workflow tool` 节点、宿主适配层和内置工具包三者一致的正式能力，并尽量迁入 PI `coding-agent` 已有的基础工具集合。

## 1. 最终实现目标

阶段 13 完成后，系统应建立稳定的“PI 宿主工具调用 + 内置基础工具”主链路，使 `pi-workflow` 不只是在接口层声明 `callTool()`，而是能真正执行宿主工具，并提供一组无头可用的基础工具能力。

目标能力：

1. `PiHostAdapter` 正式实现 `callTool()`，打通 workflow `tool` 节点到宿主工具执行链路。
2. `ToolExecutor` 在本地工具未命中时，可通过宿主 `callTool()` 执行 PI/扩展/内置工具，而不是停留在接口占位。
3. `packages/pi-builtin-tools` 新增无头版 `read`、`write`、`edit`、`ls`、`grep`、`find` 等基础工具，作为正式内置工具能力。
4. 基础工具实现尽量复用 PI `coding-agent` 现有能力模型与核心算法，但去除 TUI、渲染和交互壳层。
5. `fs.read`、`fs.write`、`process.execute` 等权限模型按工具类型真正接入执行链路，而不是只存在于配置与静态类型中。
6. CLI / runtime / host 对“哪些工具可用、哪些工具可执行、哪些工具被权限拒绝”有一致行为与错误语义。
7. 至少形成一条真实可验证链路：workflow `tool` 节点调用 `read` / `write` / `edit` / `grep` / `find` / `ls` 等内置工具并通过测试。

本阶段不要求：

1. 一次性无差别迁入 PI `coding-agent` 全部工具。
2. 复刻 PI `coding-agent` 的 TUI 展示、增量高亮、diff 可视化和交互渲染。
3. 在本阶段承诺完整复用 PI 任意第三方工具定义格式。
4. 处理 OS 级沙箱、远程文件系统或 SSH 文件工具代理。

## 2. 已确认实现边界

1. 本阶段按两批推进：
   - 第一批：`read`、`write`、`edit`
   - 第二批：`ls`、`grep`、`find`
   - 高风险后置：`bash`
2. `PiHostAdapter.callTool()` 的第一阶段可先只桥接：
   - CLI 装配进来的 native tools / extension tools
   - `@pi-workflow/builtin-tools` 暴露的无头工具
3. `callTool()` 不要求在第一阶段直接对接 PI 全量宿主工具注册表；优先保证当前仓库内已装配工具可被统一调用。
4. `packages/pi-builtin-tools` 中迁入的工具必须保持无头执行风格，统一输出 `{ content, isError }`。
5. 允许参考 `E:\coder\pi-workflow\.pi\packages\coding-agent\src\core\tools\` 的实现，但默认按“裁剪式移植”处理，不做整文件原样拷贝。
6. 允许抽取并复用如下核心能力：
   - 路径解析
   - 文本截断
   - 文件串行变更队列
   - 精确文本替换与 patch 生成算法
   - 目录遍历、文本匹配与结果截断
7. 迁入后代码不应重新依赖 `@earendil-works/pi-tui`、`@earendil-works/pi-ai` 的渲染侧能力。
8. 权限模型以阶段 11 既有能力位为准：`fs.read`、`fs.write`、`process.execute`、`extension.execute`。
9. `grep`、`find`、`ls` 原则上优先实现为纯 Node / 文件系统能力，不依赖 shell。
10. `bash` 若迁入，必须单独标记高风险并单列权限与平台策略，不与首批工具捆绑验收。

## 3. 当前已进行工作

阶段 13 已于 2026-05-30 全部实现并测试验收，具体完成项如下：

1. **`PiHostAdapter.callTool()` 已实现**：
   - 新增统一工具注册表 `Map<string, HostCallableToolRecord>`
   - 支持 `builtin` / `native` / `extension` 三层来源，按固定优先级查找
   - 查找 -> 能力位权限检查 -> 执行 -> 错误折叠为 `{ content, isError }`
   - 同名工具不做静默覆盖，输出 warning 日志
   - 新增 `HostCallableToolRecord` 类型（导出自 `adapters/pi/types.ts`）
   - `PiHostAdapterOptions` 新增 `builtinTools?: ReadonlyArray<HostCallableToolRecord>`

2. **`ToolExecutor` 回退到宿主 `callTool()` 链路已闭环**：
   - 本地工具命中 -> 执行本地
   - 本地工具未命中 -> `host.callTool()` -> 宿主工具
   - 无宿主能力 -> 返回 unsupported 错误

3. **`MockPiHostAdapter` 新增 `callTool()` 支持**：
   - 新增 `setToolResponse()` 用于注入 mock 返回
   - `callTool()` 默认返回 mock 结果

4. **`packages/pi-builtin-tools` 新增六个无头基础工具**：
   - `read`：支持 `offset`/`limit`、截断续读提示、越界检查
   - `write`：支持自动创建父目录、UTF-8 覆盖写入
   - `edit`：支持精确文本匹配、多段替换、LF 归一化、patch 生成
   - `ls`：目录列举、文件/目录区分、基础排序
   - `grep`：支持正则匹配、目录递归、结果截断
   - `find`：支持 glob 模式匹配、深度限制、结果截断
   - 配套 `truncate.ts`、`path-utils.ts`、`file-mutation-queue.ts` 工具函数

5. **统一注册入口 `register.ts`**：
   - 位于 `packages/pi-builtin-tools/src/register.ts`
   - 返回 `HostCallableToolRecord[]`，包含全部六个基础工具
   - 每个工具标注对应的 capability（`fs.read` / `fs.write`）

6. **CLI `run.ts` 装配内置工具**：
   - 动态导入 `registerBuiltinTools()`，装入 `PiHostAdapter.builtinTools`
   - 装配顺序：native -> extension -> builtin（builtin 最高优先级）

7. **新增测试**：
   - `test/adapters/pi/pi-host-adapter-call-tool.test.ts`：7 个测试项
   - `test/executors/tool-executor-host-call.test.ts`：4 个测试项
   - `test/fixtures/dsl/builtin-{read,write,edit,ls,grep,find}.workflow.json`：6 个 workflow fixture

8. **所有测试通过**：60 test files / 354 tests 全部通过，lint 无新增错误。

## 4. 目标能力拆解

### 4.1 宿主工具调用主链路

系统应支持：

1. `WorkflowRuntime -> ToolExecutor -> host.callTool() -> tool result`
2. 调用结果统一回写为 `tool` artifact
3. 调用失败时产生清晰的错误分类：
   - 工具不存在
   - 工具已发现但未启用
   - 工具已启用但权限拒绝
   - 工具执行异常

### 4.2 无头基础工具能力

系统应提供：

1. `read`
   - 支持读取文本文件
   - 支持 `offset` / `limit`
   - 支持截断与续读提示
2. `write`
   - 支持新建或整体覆盖文件
   - 自动创建父目录
3. `edit`
   - 支持基于精确文本匹配的多段替换
   - 保留标准 patch / diff 生成能力供调试与测试使用
4. `ls`
   - 支持目录列举
   - 支持相对路径与基础过滤
5. `grep`
   - 支持文本模式匹配
   - 支持目录递归与结果截断
6. `find`
   - 支持按名称/路径模式查找文件
   - 支持基础深度或范围限制

### 4.3 权限与安全语义

系统应收敛为：

1. `read` 调用前检查 `fs.read`
2. `write` / `edit` 调用前检查 `fs.write`
3. `ls` / `grep` / `find` 调用前检查 `fs.read`
4. `bash` 若后续接入，调用前检查 `process.execute`
5. 扩展工具调用继续沿用 `extension.execute`
6. 当 workflow 配置允许但 PI 宿主策略拒绝时，错误语义保持与现有 `PiPermissionBridge` 一致

### 4.4 内置工具装配

系统应明确：

1. 哪些工具来自 `PiExtensionBridge.getNativeTools()`
2. 哪些工具来自 `@pi-workflow/builtin-tools`
3. 哪些工具来自用户安装的 extension 包
4. `callTool()` 应统一在同一注册表视角下查找，而不是散落在不同链路中

## 5. 目录设计

目标目录设计如下：

```text
packages/pi-workflow/src/
  adapters/pi/
    pi-host-adapter.ts
    types.ts
    permission-bridge.ts
  executors/
    tool-executor.ts

packages/pi-builtin-tools/src/
  index.ts
  tools/
    read.ts
    write.ts
    edit.ts
    ls.ts
    grep.ts
    find.ts
    truncate.ts
    path-utils.ts
    file-mutation-queue.ts

packages/pi-builtin-tools/test/
  read.test.ts
  write.test.ts
  edit.test.ts
  ls.test.ts
  grep.test.ts
  find.test.ts

packages/pi-workflow/test/
  adapters/pi/
    pi-host-adapter-call-tool.test.ts
  executors/
    tool-executor-host-call.test.ts
  fixtures/
    dsl/
      builtin-read.workflow.json
      builtin-write.workflow.json
      builtin-edit.workflow.json
      builtin-ls.workflow.json
      builtin-grep.workflow.json
      builtin-find.workflow.json
```

说明：

1. `truncate.ts`、`path-utils.ts`、`file-mutation-queue.ts` 可先放在 `pi-builtin-tools` 包内，避免过早上提到 core 公共层。
2. 若后续确认多个包共享，再单独规划公共抽取阶段。

## 6. 核心结构设计

### 6.1 宿主工具注册项

```typescript
export interface HostCallableToolRecord {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  readonly capability?: "fs.read" | "fs.write" | "process.execute" | "extension.execute";
  readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
}
```

说明：

1. `PiHostAdapter` 内部需要统一维护这类记录，作为 `callTool()` 的查找基础。
2. `capability` 用于在真正执行前触发权限检查。

### 6.2 `callTool()` 最小语义

```typescript
callTool(request: WorkflowToolRequest): Promise<WorkflowToolResult>
```

执行语义：

1. 先按名称查找工具
2. 若未找到，返回结构化 `isError: true`
3. 若命中且声明能力位，则先检查权限
4. 权限通过后执行工具
5. 统一把文本结果折叠为 `WorkflowToolResult`

### 6.3 基础工具裁剪策略

以 PI `coding-agent` 为来源时，按以下规则处理：

1. 保留：
   - schema
   - operations 接口
   - 核心文件读写逻辑
   - 截断算法
   - 精确编辑算法
   - 文件变更串行队列
   - 目录遍历与文本匹配算法
2. 删除：
   - `pi-tui` 组件
   - `renderCall` / `renderResult`
   - 主题、高亮、diff 可视化
   - 与模型能力判断相关的 UI 输出
3. 改写：
   - 输出协议改为 `{ content, isError }`
   - 权限由 workflow/host 侧统一检查
   - 错误文本改为适配 CLI / headless 场景

### 6.4 `PiHostAdapter.callTool()` 实现细节

建议按以下内部结构实现：

```typescript
interface PiHostAdapterOptions {
  readonly extensionTools?: ReadonlyArray<...>;
  readonly builtinTools?: ReadonlyArray<...>;
  readonly permissionCheck?: (...args) => ...;
}

interface RegisteredToolRecord {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  readonly capability?: "fs.read" | "fs.write" | "process.execute" | "extension.execute";
  readonly source: "builtin" | "native" | "extension";
  readonly execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
}
```

查找顺序建议固定为：

1. `builtinTools`
2. `nativeTools`
3. `extensionTools`

说明：

1. `builtin` 优先是为了让 `pi-workflow` 自己控制最小稳定能力集。
2. 若名称冲突，不做静默覆盖：
   - 默认保留优先级更高者
   - 同时输出 debug / warning 日志

`callTool()` 的执行顺序建议固定为：

1. 读取 `request.toolName`
2. 在已注册工具表中查找
3. 未命中时返回：

```typescript
{ content: `Tool not found: ${toolName}`, isError: true }
```

4. 命中后按 `capability` 决定是否检查权限
5. 若 `checkPermission()` 返回拒绝，统一返回：

```typescript
{ content: `[PI] ${reason}`, isError: true }
```

6. 调用工具 `execute(params)`
7. 若工具内部抛异常，捕获并统一折叠为：

```typescript
{ content: err instanceof Error ? err.message : String(err), isError: true }
```

8. 保证 `callTool()` 自身永远返回 `WorkflowToolResult`，而不是把异常继续向外抛

### 6.5 built-in tools 装配细节

建议新增一个统一装配入口，例如：

```typescript
packages/pi-builtin-tools/src/register.ts
```

职责：

1. 返回 `ReadonlyArray<HostCallableToolRecord>`
2. 在内部集中注册：
   - `read`
   - `write`
   - `edit`
   - `ls`
   - `grep`
   - `find`
   - 现有 `net`
   - 现有 `web_search`
   - 现有 `web_fetch`

CLI 侧建议装配顺序：

1. `PiExtensionBridge.getNativeTools()`
2. `registerBuiltinTools()`
3. `bridge.getAllTools()`（外部 extension）
4. 合并后传给 `new PiHostAdapter({ builtinTools, extensionTools })`

建议不要把 built-in tools 继续伪装成 extension 再绕一层桥接；它们应作为宿主内建能力直接装配。

### 6.6 各工具迁移来源与改造细则

#### `read`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/read.ts`
- `.pi/packages/coding-agent/src/core/tools/truncate.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

保留：

1. `path` / `offset` / `limit` schema
2. `ReadOperations`
3. 文本截断与续读提示
4. 越界检查

删除：

1. 图片展示 UI
2. `renderCall` / `renderResult`
3. 主题、高亮、TUI 组件

改写：

1. 输出改为单段文本 `content`
2. 图片能力第一阶段可直接降级为：
   - 识别到图片时返回说明文本
   - 或直接返回 unsupported

#### `write`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/write.ts`
- `.pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

保留：

1. `path` / `content` schema
2. 自动建目录
3. 串行文件变更队列

删除：

1. 高亮缓存
2. 组件渲染

改写：

1. 输出文本统一为写入摘要
2. 错误统一折叠为 `{ content, isError }`

#### `edit`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/edit.ts`
- `.pi/packages/coding-agent/src/core/tools/edit-diff.ts`
- `.pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

保留：

1. `edits[]` 精确替换 schema
2. LF 归一化与 BOM 处理
3. patch / diff 生成
4. 多段替换逻辑

删除：

1. preview 预渲染
2. diff TUI 展示
3. 异步可视化刷新逻辑

改写：

1. `details` 中保留 `diff` / `patch` / `firstChangedLine`
2. `content` 文本只保留成功摘要

#### `ls`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/ls.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

第一阶段目标：

1. 支持列出目录项名称
2. 支持区分文件/目录
3. 支持基础排序
4. 支持结果截断

建议：

1. 优先用 Node `fs` 直接实现
2. 不必保留 PI 原有全部展示格式

#### `grep`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/grep.ts`
- `.pi/packages/coding-agent/src/core/tools/truncate.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

第一阶段目标：

1. 支持字符串或正则匹配
2. 支持递归目录
3. 支持输出文件路径、行号、片段
4. 支持结果数量截断

建议：

1. 若 PI 原实现强依赖 shell，则改为纯 Node 扫描
2. 优先保证 Windows 下可用

#### `find`

来源文件建议：

- `.pi/packages/coding-agent/src/core/tools/find.ts`
- `.pi/packages/coding-agent/src/core/tools/path-utils.ts`

第一阶段目标：

1. 支持按名称模式查找
2. 支持相对根目录
3. 支持深度限制
4. 支持结果截断

建议：

1. 同样优先走纯 Node 实现
2. 不依赖 shell `find`

### 6.7 错误与返回格式细节

建议统一返回风格：

```typescript
type ToolTextResult = {
  content: string;
  isError: boolean;
  details?: Record<string, unknown>;
}
```

约定：

1. `content` 始终是给 workflow/CLI 看的主文本
2. `details` 只用于测试断言、后续 trace 展示或 debug
3. `read`：
   - `details.truncation`
4. `edit`：
   - `details.diff`
   - `details.patch`
   - `details.firstChangedLine`
5. `grep` / `find` / `ls`：
   - `details.matches` 或 `details.entries`
   - 第一阶段不要求暴露完整复杂结构，但要保留可测信息

## 7. 实现路径

### 第 1 步：补齐 `PiHostAdapter.callTool()`

1. 在 `PiHostAdapter` 中建立统一工具注册表。
2. 将 `extensionTools` 纳入该注册表。
3. 实现 `callTool()`：查找 -> 权限检查 -> 执行 -> 结果归一化。
4. 为“找不到工具”和“工具执行失败”补测试。
5. 同时补名称冲突处理策略，避免 built-in / extension 同名静默覆盖。

### 第 2 步：定义内置基础工具无头协议

1. 在 `pi-builtin-tools` 中定义 `read` / `write` / `edit` / `ls` / `grep` / `find` 的无头返回格式。
2. 明确每个工具对应的 capability：
   - `read` -> `fs.read`
   - `write` -> `fs.write`
   - `edit` -> `fs.write`
   - `ls` -> `fs.read`
   - `grep` -> `fs.read`
   - `find` -> `fs.read`
3. 在 `index.ts` 中注册这批工具。

### 第 3 步：迁入 `read`

1. 参考 PI `read.ts` 裁剪出无头版实现。
2. 迁入 `truncate.ts` 与必要路径工具。
3. 保留 `offset` / `limit` / 截断续读逻辑。
4. 先只保证文本文件主链路；图片读取可后置为次级增强。

### 第 4 步：迁入 `write`

1. 参考 PI `write.ts` 裁剪出无头版实现。
2. 迁入 `file-mutation-queue.ts` 以避免并发写入冲突。
3. 支持自动创建父目录与 UTF-8 写入。

### 第 5 步：迁入 `edit`

1. 参考 PI `edit.ts` 及相关 diff 算法裁剪无头版实现。
2. 保留精确匹配、多段替换、LF 归一化、patch 生成。
3. 输出简洁结果文本，并在 details 中保留 diff / patch 供测试断言。

### 第 6 步：迁入 `ls` / `grep` / `find`

1. 参考 PI 对应工具实现裁剪无头版目录与检索工具。
2. 优先保留仓库浏览、文本匹配与结果截断主链路。
3. 不依赖 shell；默认走 Node 文件系统与字符串处理实现。

### 第 7 步：把内置工具接入宿主装配

1. 让 CLI / bridge 在真实 PI host 模式下默认获得 built-in 基础工具。
2. 明确 built-in tools 与 extension tools 的合并规则。
3. 避免重名工具静默覆盖；至少输出告警或采用显式优先级。

### 第 8 步：接入权限检查

1. 在 `callTool()` 中接入 `checkPermission()`
2. 在 workflow 安全配置中验证 `fs.read` / `fs.write` / `process.execute` 生效
3. 为允许 / 拒绝 / 宿主拒绝三类路径补测试

### 第 9 步：评估 `bash`

1. 单独评估 PI `bash.ts` 的平台差异、进程控制与权限模型。
2. 若裁剪成本与风险可接受，再作为阶段 13 的后半段增强项进入实现。
3. 若风险过高，明确记录为阶段 13 遗留事项，而不是阻塞首批工具验收。

### 第 10 步：真实 workflow fixture 与回归测试

1. 新增 `read` / `write` / `edit` / `ls` / `grep` / `find` 对应 DSL fixture
2. 覆盖：
   - tool 节点成功
   - 权限拒绝
   - 工具不存在
   - 编辑失败（oldText 不匹配）
3. 确保不破坏已有 `agent` + extension 工具链路

## 7.1 逐文件改造建议

建议按以下最小变更面推进：

1. `packages/pi-workflow/src/adapters/pi/pi-host-adapter.ts`
   - 新增工具注册表
   - 新增 `callTool()`
   - 新增 built-in / extension 合并逻辑
2. `packages/pi-workflow/src/adapters/pi/types.ts`
   - 若需要，为 built-in tools 补充输入类型或内部记录类型
3. `apps/pi-workflow-cli/src/commands/run.ts`
   - 新增 `registerBuiltinTools()` 装配
   - 调整传入 `PiHostAdapter` 的参数结构
4. `packages/pi-builtin-tools/src/index.ts`
   - 改成聚合注册入口，而不只注册网络工具
5. `packages/pi-builtin-tools/src/tools/*.ts`
   - 新增 `read` / `write` / `edit` / `ls` / `grep` / `find`
6. `packages/pi-builtin-tools/test/*.test.ts`
   - 为每个工具单独建测试
7. `packages/pi-workflow/test/adapters/pi/*.test.ts`
   - 断言 `callTool()` 行为
8. `packages/pi-workflow/test/executors/*.test.ts`
   - 断言 `ToolExecutor` 回退到宿主

## 8.1 测试断言点细化

### `pi-host-adapter-call-tool.test.ts`

至少断言：

1. built-in 工具可被命中
2. extension 工具可被命中
3. built-in 与 extension 重名时按预期优先级命中
4. `fs.read` 拒绝时返回 `isError: true`
5. `fs.write` 拒绝时返回 `isError: true`
6. 工具抛异常时不会把异常继续向外抛

### `tool-executor-host-call.test.ts`

至少断言：

1. 已注册本地工具优先于宿主工具
2. 本地工具缺失时调用 `host.callTool()`
3. `host.callTool()` 返回错误时，artifact 仍按 `tool` 或 `tool.error` 预期落地

### built-in tool 单测

`read`

1. 正常读取文件
2. `offset/limit` 生效
3. 截断提示包含下一次 offset
4. 文件不存在报错

`write`

1. 自动创建目录
2. 重写文件内容
3. 连续写入不互相打断

`edit`

1. 单段替换成功
2. 多段替换成功
3. `oldText` 不匹配时报错
4. `details.patch` 非空

`ls`

1. 返回目录项
2. 区分文件与目录
3. 路径不存在报错

`grep`

1. 单文件匹配
2. 目录递归匹配
3. 截断后仍给出统计

`find`

1. 名称模式匹配
2. 深度限制生效
3. 路径不存在报错

## 8. 测试与验收

验收标准：

1. `PiHostAdapter.callTool()` 已实现并可被 `ToolExecutor` 正式调用。
2. `packages/pi-builtin-tools` 提供 `read`、`write`、`edit`、`ls`、`grep`、`find` 六个无头基础工具。
3. `read` 支持 `offset` / `limit` 与截断续读提示。
4. `write` 支持自动创建目录与整体覆盖写入。
5. `edit` 支持精确文本替换、多段替换与 patch 生成。
6. `ls` / `grep` / `find` 支持基础目录与文本检索主链路。
7. `fs.read` / `fs.write` 权限在真实执行路径上生效。
8. workflow `tool` 节点可直接调用内置基础工具。
9. 扩展工具链路无回归。

建议测试矩阵：

1. `pi-host-adapter-call-tool.test.ts`
   - 成功调用
   - 工具不存在
   - 权限拒绝
   - 工具执行抛错
2. `tool-executor-host-call.test.ts`
   - 本地工具优先
   - 宿主工具回退
   - 无宿主能力时报错
3. `pi-builtin-tools/read.test.ts`
   - 全量读取
   - offset/limit
   - 截断提示
   - 越界报错
4. `pi-builtin-tools/write.test.ts`
   - 自动建目录
   - 覆盖写入
5. `pi-builtin-tools/edit.test.ts`
   - 单段替换
   - 多段替换
   - oldText 不匹配失败
   - patch/diff 断言
6. `pi-builtin-tools/ls.test.ts`
   - 目录列举
   - 路径不存在
7. `pi-builtin-tools/grep.test.ts`
   - 文本匹配
   - 递归搜索
   - 结果截断
8. `pi-builtin-tools/find.test.ts`
   - 名称匹配
   - 深度限制
9. workflow fixture 集成测试
   - `builtin-read.workflow.json`
   - `builtin-write.workflow.json`
   - `builtin-edit.workflow.json`
   - `builtin-ls.workflow.json`
   - `builtin-grep.workflow.json`
   - `builtin-find.workflow.json`

## 9. 风险与依赖

- 风险 1：若直接整文件迁入 PI `coding-agent` 工具，会把 `pi-workflow` 重新耦合回 TUI / 渲染运行时。
- 风险 2：`callTool()` 若只做最小查找、不统一权限与错误语义，后续会出现 agent/tool 双口径。
- 风险 3：`edit` 算法迁入时若裁剪不完整，容易出现换行符、BOM 或多段替换回归。
- 风险 4：`grep` / `find` / `ls` 若简单照搬实现，可能引入路径边界、性能和 Windows 兼容问题。
- 风险 5：built-in 与 extension 工具同名时，若没有显式优先级，行为会不稳定。

依赖：

1. 阶段 5 的 `tool` 节点执行链路稳定。
2. 阶段 9.5 的 extension bridge 已可装配 native/extension tools。
3. 阶段 11 的权限模型与 `PiPermissionBridge` 可复用。

## 10. 完成定义（DoD）

- [x] `PiHostAdapter.callTool()` 主链路完成。
- [x] `read` / `write` / `edit` / `ls` / `grep` / `find` 六个无头基础工具完成。
- [x] 基础工具权限检查完成并进入真实执行路径。
- [x] workflow `tool` 节点调用宿主工具闭环完成。
- [x] 阶段专用测试、fixture 与 CLI 装配验证完成。
- [x] 阶段索引、总计划和相关帮助文案已同步。

## 11. 验收结论

- 验收时间：2026-05-30 13:10 +08:00
- 技术栈：TypeScript、Node.js、Vitest、CLI
- 目标完成情况：
  - [x] `callTool()` 宿主闭环 — `PiHostAdapter.callTool()` 已实现，工具注册表、查找、权限检查、执行归一化完整
  - [x] built-in 基础工具 — `read` / `write` / `edit` / `ls` / `grep` / `find` 六个无头工具全部迁入
  - [x] 安全权限接入 — `fs.read` / `fs.write` 权限在 callTool 执行路径上生效
  - [x] workflow `tool` 节点真实验证 — ToolExecutor 本地/宿主回退链路闭环，6 个 workflow fixture 就绪
- 非功能检查：lint 通过（仅预存 extractor-executor 2 个旧错误）、60 test files / 354 tests 全部通过
- 最终判定：验收通过
- 遗留事项：
  1. `bash` 工具未迁入（计划中已列为高风险后置项，不阻塞本阶段验收）
  2. 基础工具的 Windows 兼容性可进一步细化验证（当前实现基于 Node fs 原生 API，理论兼容）
  3. `edit` 工具的 diff/patch 生成目前仅在 `details` 中保留，未在 TUI 可视化展示（阶段 8 已有 debug/trace 能力）
  4. 真实 PI 宿主工具全量注册表对接（当前以 builtin/native/extension 三层汇编为准）
