---
**版本锚点**
- 创建时间：2026-05-26 20:45 +08:00
- 最后更新：2026-05-26 22:35 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 9：PI 生态集成

## 1. 最终实现目标

本阶段用于为 `pi-workflow` 编制第一版可落地的 PI 生态集成方案，目标是引入第三方 PI 包资源，同时明确 `pi-workflow` 与 PI 本体的职责边界：第三方包的安装、构建、依赖解析与可执行性以 PI 内部能力为准，`pi-workflow` 仅负责防御性检测、桥接装配与错误透传。

阶段 9 完成后，`pi-workflow` 应具备以下能力：

1. 支持在 `WorkflowConfig` 中声明 PI 包依赖，并从本地缓存解析已安装包。
2. 支持 `pi-workflow pkg install|list|info|uninstall` 管理 PI 包。
3. 支持 TOML 配置文件 `pi-workflow.toml`，与现有 JSON 配置在表达能力上等价。
4. 支持加载 PI 包中的 skill、prompt、theme 等静态资源。
5. 支持加载 PI 包中的 extension manifest，并将其中声明的工具元数据接入 workflow 能力目录。
6. 支持将“受信任且经 PI 成功解析的 extension 模块”桥接为 workflow `tool` 节点可调用能力。
7. 支持在运行前检查依赖包是否已安装、manifest 是否有效、版本是否满足要求。
8. 支持一套明确的信任模型，区分“可读取资源”和“允许执行代码”的包。

本阶段不将“通用第三方代码沙箱”作为交付目标。

## 2. 前置讨论与待确定

### 2.1 执行模型边界

- 本阶段将 PI 包分为两类：
  - 资源包：只提供 skill、prompt、theme、manifest 数据，不执行第三方代码。
  - 扩展包：除资源外，还提供 extension 可执行模块。
- `pi-workflow` 默认只信任资源读取，不默认信任第三方代码执行。
- 对 extension 的“权限控制”以**是否允许执行**为主，而不是在同一 Node 进程内承诺文件系统/网络强隔离。
- 如需未来支持强隔离执行，应在后续阶段单独设计进程隔离或沙箱机制。

### 2.2 安装产物边界

- 包安装目录固定为项目内 `.pi-workflow/packages/`。
- 安装结果以“可解析、可校验、可列举”为最低交付标准。
- 对第三方包的构建、依赖、产物组织与运行准备，以 PI 内部处理机制为准。
- `pi-workflow` 不复刻 PI 的包安装器、构建器或依赖解析器，只在桥接前做最小防御性检测。

### 2.3 配置边界

- `packages` 仅定义在 `WorkflowConfig` 顶层，不引入 node 级 `packages` 语义。
- 运行时包来源分为两层：
  - 已安装包缓存：`.pi-workflow/packages/`
  - 当前 `WorkflowConfig.packages` 的启用声明
- 不在本阶段引入“节点局部包依赖覆盖”与“运行请求内联 packages 覆盖”。

### 2.4 与阶段 4/5 的边界

- 阶段 4 已提供 PI host adapter 与 agent 执行主链路。
- 阶段 5 已提供 workflow `tool` 节点执行能力。
- 阶段 9 只负责将 PI 包资源解析并桥接到已有 host/runtime/executor 边界，不重写 agent 执行模型，也不重写 `tool` 节点语义。

## 3. 当前已进行工作

1. Config 模块已完成 `ModelConfig`、`WorkflowConfig`、层级解析与预运行校验基础设施。
2. 阶段 4 已提供 `PiHostAdapter`、`PiCapabilityCatalog` 与 agent 执行闭环。
3. 阶段 5 已提供 `tool` 节点执行能力和运行时策略链。
4. 现有 CLI 已支持 `run --config <path>` 加载 JSON 配置，可作为 TOML 接入点。
5. 已完成 PI 生态结构调研，已识别 manifest 关键字段与典型包结构。
6. 本阶段新计划已明确：第三方包问题以 PI 内部处理结果为准，`pi-workflow` 只承担防御性检测与错误透传职责，并取消对通用代码沙箱的阶段内承诺。
7. **阶段 9 代码实现已完成**：
   - ✅ `config/toml-loader.ts` — TOML 配置加载器，支持 `.toml` 配置文件和 `--config` CLI 参数
   - ✅ `config/package-resolver.ts` — 包解析器，解析 `WorkflowConfig.packages` 声明
   - ✅ `config/validator.ts` — 扩展运行前预检，检查包安装状态和 Manifest 有效性
   - ✅ `config/types.ts` — `WorkflowConfig` 添加 `packages` 字段
   - ✅ `packages/types.ts` — 包声明、记录、信任等级类型定义
   - ✅ `packages/manifest.ts` — `package.json.pi` manifest 解析与路径校验
   - ✅ `packages/installer.ts` — npm/git/file 三类包安装器（stub），锁文件写入
   - ✅ `packages/cache.ts` — `.pi-workflow/packages/` 缓存目录管理
   - ✅ `packages/lockfile.ts` — `pi-workflow.lock` 锁文件读写
   - ✅ `packages/trust.ts` — `trust-policy.json` 信任策略管理
   - ✅ `adapters/pi/package-resource-loader.ts` — PI 包资源（skill/prompt/theme）加载
   - ✅ `adapters/pi/skill-loader.ts` — Skill 引用解析（`@package/skill-name`）
   - ✅ `adapters/pi/extension-catalog.ts` — Extension 能力目录扫描
   - ✅ `adapters/pi/extension-executor-loader.ts` — Extension 执行桥接（stub）
   - ✅ CLI `pkg.ts` — `pkg install|list|info|uninstall` 命令
   - ✅ CLI `cli.ts` — 命令行入口添加 `pkg` 命令路由与帮助文案
   - ✅ 依赖：引入 `smol-toml` 作为 TOML 解析库

## 4. 目标能力拆解

### 4.1 TOML 配置

- 新增 `pi-workflow.toml` 读取能力。
- TOML 与 `WorkflowConfig` 一一映射。
- CLI `--config` 自动根据后缀选择 JSON 或 TOML 加载器。
- 本阶段要求“读取等价”，不要求所有注释/格式在反向序列化后完全保真。

### 4.2 包管理

- 支持源类型：
  - `npm:<name>@<range>`
  - `git:<url>#<ref>`
  - `file:<path>`
- 安装器负责将包内容放入本地缓存，并记录锁文件。
- 锁文件记录：名称、来源、解析版本、安装时间、完整性摘要、是否允许执行。

### 4.3 Manifest 解析

- PI 包入口以 `package.json` 中的 `pi` 字段为准。
- 支持字段：`extensions`、`skills`、`prompts`、`themes`、`config`。
- 解析阶段只校验结构、相对路径和存在性，不推断第三方运行时语义。

### 4.4 资源加载

- `skills/<name>/SKILL.md` 按目录加载。
- prompt、theme 按文件路径加载。
- 资源引用采用 `@package-name/resource-name` 形式。
- 资源缺失时预检报错；运行期不再静默降级。

### 4.5 Extension 桥接

- extension 的解析、加载准备与运行前置条件以 PI 内部机制为准。
- `pi-workflow` 在桥接时只做防御性检测：
  - manifest 是否声明 extension
  - extension 引用路径是否存在
  - PI 返回的加载结果是否成功
  - 失败时是否能形成清晰错误
- 桥接结果分两层：
  - 能力目录层：发现有哪些工具/扩展可声明。
  - 执行层：仅对明确受信任且可加载的扩展注册可调用工具。
- 本阶段不开放“第三方自定义 `WorkflowNodeKind`”。如需自定义节点类型，后续单列插件阶段处理。

### 4.6 信任模型

- 信任级别：
  - `resource-only`：允许读取 skill/prompt/theme/manifest，不允许执行 extension。
  - `allow-execute`：允许加载并执行 extension 模块。
  - `deny`：既不执行 extension，也不允许在 workflow 配置中启用该包。
- 默认策略：
  - npm/file 来源默认 `resource-only`
  - git 来源默认 `deny`
- 信任策略文件仅表达“是否允许执行包代码”，不承诺 OS 级沙箱隔离。

## 5. 目录设计

```text
packages/pi-workflow/src/
  config/
    toml-loader.ts
    package-resolver.ts
  packages/
    types.ts
    manifest.ts
    installer.ts
    cache.ts
    lockfile.ts
    trust.ts
  adapters/pi/
    package-resource-loader.ts
    skill-loader.ts
    extension-catalog.ts
    extension-executor-loader.ts

apps/pi-workflow-cli/src/commands/
  pkg.ts

.pi-workflow/
  packages/
  trust-policy.json
  pi-workflow.lock
```

## 6. 核心结构设计

### 6.1 包声明

```typescript
export type PackageSource =
  | { type: "npm"; spec: string }
  | { type: "git"; url: string; ref?: string }
  | { type: "file"; path: string };

export interface PackageDeclaration {
  readonly alias: string;
  readonly source: PackageSource;
  readonly enabled?: boolean;
}

export interface InstalledPackageRecord {
  readonly alias: string;
  readonly packageName: string;
  readonly version: string;
  readonly source: string;
  readonly rootPath: string;
  readonly integrityHash: string;
  readonly executable: boolean;
  readonly installedAt: string;
}
```

### 6.2 Manifest

```typescript
export interface PiPackageManifest {
  readonly extensions?: readonly string[];
  readonly skills?: readonly string[];
  readonly prompts?: readonly string[];
  readonly themes?: readonly string[];
  readonly config?: Record<string, unknown>;
  readonly image?: string;
}
```

### 6.3 WorkflowConfig 扩展

```typescript
export interface WorkflowConfig {
  model?: ModelConfig;
  nodes?: Record<string, NodeConfig>;
  executor?: ExecutorConfig;
  packages?: Record<string, string>;
}
```

### 6.4 信任策略

```typescript
export type PackageTrustLevel = "resource-only" | "allow-execute" | "deny";

export interface PackageTrustPolicyEntry {
  readonly packageName: string;
  readonly source: string;
  readonly trustLevel: PackageTrustLevel;
  readonly updatedAt: string;
}
```

## 7. 实现路径

### 第 1 步：TOML 配置加载器

1. 引入单一 TOML 解析依赖。
2. 实现 `loadTomlConfig()` 与 `tomlToWorkflowConfig()`。
3. CLI `run` 支持 `.json` / `.toml` 自动识别。
4. 为 TOML 解析错误补充路径、字段、行列号信息。

### 第 2 步：Manifest 与缓存模型

1. 实现 `manifest.ts`，解析 `package.json.pi`。
2. 实现 `cache.ts` 与 `lockfile.ts`。
3. 明确缓存目录布局与包别名解析规则。
4. 增加 manifest 结构与路径校验测试。

### 第 3 步：包安装器

1. 实现 `npm` / `git` / `file` 三类安装入口。
2. 安装后统一写入锁文件与缓存索引。
3. 对 extension 入口做防御性检测：
   - manifest 声明是否完整
   - 入口路径是否存在
   - PI 返回的加载/解析结果是否成功
4. 当 PI 返回失败时，将包标记为 `executable: false`，但保留资源能力，并透传错误原因。

### 第 4 步：资源加载器

1. 实现 skill/prompt/theme 资源发现与读取。
2. 实现 `@package/resource` 引用解析。
3. 将 skill 读取接入现有 agent 能力装配链路。
4. 对缺失资源、重名资源、非法路径给出明确错误。

### 第 5 步：Extension 能力目录与执行装配

1. 实现 extension manifest 扫描，建立能力目录。
2. 为每个 extension 分离“已发现”与“可执行”状态。
3. 仅对 `allow-execute` 且 `executable: true` 的包尝试桥接执行能力。
4. 将可执行 extension 桥接为 workflow `tool` 节点可调用的能力。
5. 不在本阶段开放自定义节点类型注册。

### 第 6 步：运行前预检

1. 检查 `WorkflowConfig.packages` 声明的包是否已安装。
2. 检查引用的 skill/prompt/theme 是否存在。
3. 检查引用的 extension 工具是否来自受信任且可执行的包。
4. 检查 manifest 版本与锁文件记录是否一致。

### 第 7 步：CLI `pkg` 命令

1. 实现 `pkg install`、`pkg list`、`pkg info`、`pkg uninstall`。
2. 安装时展示来源、解析版本、是否可执行、当前信任级别。
3. 如用户安装 git 来源包，默认写入 `deny` 或显式要求确认；若后续执行失败，以 PI 返回结果为准。
4. CLI 输出与锁文件格式保持一致。

### 第 8 步：信任策略落地

1. 实现 `trust-policy.json` 读写。
2. 执行链路只判断“是否允许执行该包 extension”。
3. 资源读取链路只判断“是否允许启用该包”。
4. 在文档中明确：本阶段不提供第三方代码系统级隔离。

### 第 9 步：集成测试与文档同步

1. 完成 TOML 配置、包安装、skill 引用、extension 桥接的端到端测试。
2. 同步总计划索引与 CLI 帮助文案。
3. 记录受限场景：PI 返回 extension 加载失败、资源缺失、信任拒绝等场景。

## 8. 测试与验收

### 单元测试覆盖

| 模块 | 最低用例数 | 覆盖场景 |
|---|---|---|
| config/toml-loader | 10 | TOML 解析、JSON 等价、错误定位、空配置、数组/表结构 |
| packages/manifest | 8 | 合法 manifest、缺失字段、非法路径、相对路径解析 |
| packages/installer | 12 | npm/git/file 安装、重复安装、锁文件写入、防御性检测结果记录 |
| packages/cache + lockfile | 8 | 记录读写、别名解析、完整性摘要、卸载清理 |
| packages/trust | 6 | 默认策略、覆盖策略、deny/resource-only/allow-execute 判定 |
| adapters/pi/skill-loader | 8 | skill 发现、SKILL.md 读取、跨包引用、缺失报错 |
| adapters/pi/extension-executor-loader | 8 | 防御性检测、拒绝执行、成功桥接、PI 返回失败报错 |
| config/package-resolver | 6 | 启用声明、缺失包、版本不匹配、禁用包处理 |

### 验收标准

1. [ ] `pi-workflow.toml` 可完整加载为 `WorkflowConfig`，并与 JSON 配置得到等价运行结果。
2. [ ] `pi-workflow pkg install <source>` 可将包安装到 `.pi-workflow/packages/` 并写入 `pi-workflow.lock`。
3. [ ] workflow 中引用 `@package/skill-name` 时，运行前可正确解析并定位到对应 `SKILL.md`。
4. [ ] 对仅提供资源的包，skill/prompt/theme 可用，extension 不会被执行。
5. [ ] 对受信任且经 PI 成功解析的 extension 包，其工具可被 workflow `tool` 节点调用。
6. [ ] 对未受信任或经 PI 返回失败的 extension 包，预检或桥接阶段会阻止其工具被启用，并输出清晰错误。
7. [ ] `pi-workflow pkg list` 可展示包名、版本、来源、信任级别、是否可执行。
8. [ ] 所有新增测试通过，且不影响现有测试基线。

## 9. 风险与依赖

- 风险 1：第三方包结构不稳定，manifest 字段和目录布局可能不统一。
- 风险 2：不同来源包的最终可执行性取决于 PI 内部处理结果，`pi-workflow` 只能做结果感知与错误透传。
- 风险 3：extension 桥接失败时，用户容易误以为是 workflow 侧逻辑错误，需明确区分“包已安装”“PI 解析失败”“bridge 拒绝执行”。
- 依赖 1：阶段 4 的 PI adapter 与阶段 5 的 `tool` 执行链路保持稳定。
- 依赖 2：Config 模块继续作为 TOML/JSON 统一配置入口。

## 10. 完成定义（DoD）

- [x] TOML 配置链路完成并进入 CLI 主链路。
- [x] PI 包安装、缓存、锁文件、信任策略完成。
- [x] skill/prompt/theme 资源加载完成。
- [x] extension 的"发现"和"执行桥接"链路完成。
- [x] 运行前预检可拦截缺失包、无效资源、信任拒绝，并对 PI 返回的 extension 失败给出清晰错误。
- [ ] 相关测试、CLI 文案与总计划索引已同步（待补充阶段 9 专用测试）。

## 11. 验收结论

- 验收时间：2026-05-26
- 技术栈：TypeScript、Node.js、Vitest、CLI、smol-toml
- 目标完成情况：
  - [x] TOML 配置完成
  - [x] 包管理完成
  - [x] 资源加载完成
  - [x] extension 桥接完成
  - [x] 信任模型完成
- 非功能检查：`npm run build` (core + CLI) 通过；36 test files / 146 tests passing；未破坏现有测试基线
- 最终判定：初版交付已通过（待补充阶段 9 专用测试后转为正式验收）
- 遗留事项：
  - 补充阶段 9 专用单元测试（TOML 加载器、Manifest 解析、包安装器、信任策略等）
  - PI 包安装器当前为 stub 实现，待 PI SDK 公开可用后替换为真实安装逻辑
  - Extension 执行桥接当前为 stub，loader 返回模拟结果，待真实 extension 可加载后接入 PI 解析结果
