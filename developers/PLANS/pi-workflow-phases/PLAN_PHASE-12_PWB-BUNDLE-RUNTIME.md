---
**版本锚点**
- 创建时间：2026-05-27 00:18 +08:00
- 最后更新：2026-05-27 18:20 +08:00
- 阶段状态：主链路已完成
- 代码快照日期：2026-05-27

---

# 阶段 12：PWB Bundle 运行态

## 1. 最终实现目标

阶段 12 完成后，系统应建立稳定的 `pwb` 运行态主链路，使工作流从“目录作者态直接运行”演进为“目录导入、构建 bundle、运行 bundle”。

目标能力：

1. 支持将目录式 workflow 构建为单文件 `*.pwb`。
2. 支持从 `*.pwb` 独立加载工作流定义并运行。
3. 支持 bundle 内 `manifest`、`document`、`resources` 三层结构。
4. 支持文本、图片、二进制等资源以稳定方式进入 bundle。
5. 运行时不依赖原始目录即可执行 bundle。
6. CLI 建立 `build <workflow-dir>` 与 `run <workflow.pwb>` 主链路。
7. 明确目录是作者态输入，`pwb` 是运行态输入。

## 2. 已确认实现边界

1. `pwb` 第一阶段直接采用 zip 容器，文件后缀保持 `.pwb`。
2. bundle 内 `document.json` 第一阶段只保存最终 DSL 文档，不保存 IR。
3. 资源声明第一阶段只支持 `flow.json` 根层 `resources`，不开放节点层声明。
4. 默认只打包 DSL 显式引用或 `resources` 显式声明的文件，不做全目录自动扫描。
5. 默认资源策略如下：UTF-8 且不超过 `64KB` 的文本可 `inline`；图片、二进制、非 UTF-8、超过 `64KB` 的文本走 `archive`；超过 `10MB`、未声明未引用、路径非法的资源走 `reject`。
6. `run` 默认拒绝目录输入；若用户显式使用 `run --dir <workflow-dir>`，则先将目录构建为临时 `pwb`，再运行该 bundle。
7. `run` 默认拒绝 JSON 文件输入；若用户显式使用 `run --json <workflow.json>`，则先按对象态加载，再构建临时 `pwb` 后运行，不允许绕过 bundle 运行入口直接执行。
8. `run --dir` 或 `run --json` 生成的临时 `pwb` 默认在运行后删除；调试模式可作为后续增强提供保留开关。
9. bundle 哈希校验在加载时默认强制执行，不提供静默跳过的默认路径。
10. 第一阶段不把 workflow config 快照写入 bundle，`manifest.configSnapshot.included = false`。
11. 阶段 12 除主链路外，顺带纳入独立 `resources/` 模块与只读型 `bundle inspect` / `bundle info` 命令。
12. 第一阶段只预留签名相关字段，不实现验签与信任链闭环。

## 3. 当前已进行工作

已完成：

1. ✅ 目录作者态主链路已存在：`flow.json` / `nodeFiles` / `promptFile` / `subWorkflowDir` 已可展开。
2. ✅ CLI `run` 已能运行目录式 workflow，具备后续切换到 bundle 运行入口的基础。
3. ✅ 已形成 `pwb` 设计分析文档：`developers/ANALYSIS/ANALYSIS_PWB-BUNDLE-WORKFLOW.md`。
4. ✅ `bundle/` 模块：`types.ts`、`errors.ts`、`build.ts`、`load.ts`、`validator.ts`、`resource-reader.ts`、`inline-resource.ts`、`zip-util.ts`、`build-utils.ts` 全部实现。
5. ✅ `resources/` 模块：`types.ts`、`classify.ts`、`collect.ts`、`metadata.ts`、`path-policy.ts` 全部实现。
6. ✅ `buildPwbFromDirectory()`：目录 -> 资源收集/分类 -> inline 内联 document / archive 写入 zip -> 生成 .pwb。
7. ✅ `loadPwbFile()`：打开 zip -> 校验 manifest/document/resource 哈希与大小 -> 提取 inline 资源 -> 装配 DSL 校验。
8. ✅ CLI `build <workflow-dir>` 命令：支持 `--out`、`--overwrite`、`--debug`。
9. ✅ CLI `run <workflow.pwb>` / `run --dir` / `run --json`：目录直跑默认拒绝，`--dir`/`--json` 构建临时 bundle -> 运行 -> 自动清理。
10. ✅ CLI `inspect <workflow.pwb>`：输出 manifest/document/resource 摘要，支持 `--json` 结构化输出。
11. ✅ manifest 含 `configSnapshot.included = false` 与 `signature` 预留字段。
12. ✅ `BUNDLE-001` ~ `BUNDLE-012` 诊断码全部就位。
13. ✅ build/load/run/inspect 四类测试矩阵（30 tests）全部通过。
14. ✅ `npm run lint` 通过、`npm test` 全仓通过。

## 4. 目录设计

```text
packages/pi-workflow/
  src/
    bundle/
      types.ts
      errors.ts
      build.ts
      load.ts
      validator.ts
      resource-reader.ts
    resources/
      types.ts
      classify.ts
      collect.ts
      metadata.ts
      path-policy.ts
      index.ts
      index.ts
  test/
    bundle/
      bundle-build.test.ts
      bundle-load.test.ts
      bundle-run.test.ts
      bundle-inspect.test.ts
    fixtures/
      bundle-flow/
      bundle-flow-with-assets/
apps/pi-workflow-cli/
  src/
    commands/
      build.ts
      inspect.ts
```

## 5. 结构设计

### Bundle 模块边界

新增 `src/bundle/`，职责只包含：

1. 从目录构建 `pwb`
2. 从 `pwb` 加载运行态文档
3. 提供 bundle 内资源访问能力
4. 校验 bundle 结构、版本与资源摘要

不在本阶段引入媒体语义解释、图片渲染或高层业务逻辑。

### Resources 模块边界

新增 `src/resources/`，职责只包含：

1. 资源路径合法性校验
2. 资源类型与编码识别
3. 资源哈希与元数据生成
4. `inline` / `archive` / `reject` 策略判定
5. 资源引用归一化与收集

`resources/` 只提供底层资源处理能力，不直接依赖 runtime 语义。

### 建议核心类型

1. `WorkflowBundleManifest`
2. `WorkflowBundleResourceEntry`
3. `WorkflowBundleLoadResult`
4. `WorkflowBundleResourceReader`

第一阶段建议直接固化如下结构：

```ts
export interface WorkflowBundleManifest {
  readonly kind: "pi-workflow-bundle";
  readonly bundleVersion: "1";
  readonly workflow: {
    readonly id: string;
    readonly title?: string;
    readonly version?: string;
  };
  readonly source: {
    readonly type: "directory";
    readonly entry: "flow.json";
    readonly builtAt: string;
  };
  readonly document: {
    readonly path: "document.json";
    readonly sha256: string;
    readonly size: number;
  };
  readonly resources: readonly WorkflowBundleResourceEntry[];
  readonly configSnapshot: {
    readonly included: false;
  };
  readonly signature?: {
    readonly format?: string;
    readonly value?: string;
  };
}

export interface WorkflowBundleResourceEntry {
  readonly path: string;
  readonly sourcePath: string;
  readonly strategy: "inline" | "archive";
  readonly mediaType?: string;
  readonly encoding?: string;
  readonly size: number;
  readonly sha256: string;
  readonly usage: readonly string[];
}

export interface WorkflowBundleLoadResult {
  readonly manifest: WorkflowBundleManifest;
  readonly document: WorkflowDslDocument;
  readonly resourceReader: WorkflowBundleResourceReader;
}

export interface WorkflowBundleResourceReader {
  has(path: string): boolean;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  getMetadata(path: string): {
    mediaType?: string;
    size: number;
    sha256: string;
  };
}
```

### Manifest 最小字段边界

第一阶段 `manifest.json` 至少包含以下稳定字段：

1. `kind` 与 `bundleVersion`
2. `workflow.id`、`workflow.title`、`workflow.version`
3. `source.type`、`source.entry`、`source.builtAt`
4. `document.path`、`document.sha256`
5. `resources[].path`、`resources[].sourcePath`、`resources[].mediaType`、`resources[].size`、`resources[].sha256`、`resources[].usage`
6. `configSnapshot.included = false`
7. `signature` 预留字段，仅用于后续扩展，不参与本阶段验收

### 运行时加载边界

bundle 运行时建议按以下顺序执行：

1. 打开 `.pwb` 容器
2. 读取 `manifest.json`
3. 校验 `kind` 与 `bundleVersion`
4. 读取并校验 `document.json`
5. 建立 `resourceReader`
6. 将 `document` 装配回现有 DSL -> IR -> runtime 主链路

### Build 主流程

`buildPwbFromDirectory()` 第一阶段建议按以下顺序实现：

1. 调用现有 `loadFromDirectory()` 作为唯一作者态入口。
2. 获取最终 DSL 文档，并复用现有目录展开能力处理 `nodeFiles`、`promptFile`、`subWorkflowDir`。
3. 收集两类资源：DSL 显式引用资源、`flow.json` 根层 `resources` 声明资源。
4. 对每个资源执行路径校验、大小检查、文本/二进制识别与策略分类。
5. 对 `inline` 资源执行最小改写；对 `archive` 资源写入 `resources/`；对 `reject` 资源直接输出结构化错误。
6. 生成最终 `document.json`。
7. 生成包含 `document` 与 `resources` 摘要的 `manifest.json`。
8. 将 `manifest.json`、`document.json` 与 `resources/**` 写入 zip 容器并输出 `.pwb`。

### Load 主流程

`loadPwbFile()` 第一阶段建议按以下顺序实现：

1. 打开 `.pwb` zip 容器。
2. 检查 `manifest.json` 与 `document.json` 是否存在。
3. 解析 `manifest.json`，校验 `kind`、`bundleVersion`、`document.path`、`resources[].path`。
4. 检查重复资源路径、非法路径、缺失资源项。
5. 读取 `document.json` 并校验其 `sha256`。
6. 逐项校验 `resources[].sha256` 与 `size`。
7. 使用 `loadFromObject()` 将解包结果重新进入现有 DSL 校验链路。
8. 构建 `resourceReader` 并返回 `manifest`、`document` 与 `resourceReader`。

### 资源策略边界

1. `inline`：UTF-8 且不超过 `64KB` 的小文本直接内联到 `document`
2. `archive`：图片、二进制、非 UTF-8 与超过 `64KB` 的大文本原样保存在 `resources/`
3. `reject`：超过 `10MB`、未声明未引用、路径非法或未允许资源直接阻断构建

### 资源声明边界

1. 第一阶段仅支持 `flow.json` 根层 `resources`
2. 资源项至少包含 `path`、`usage`、`strategy`
3. `strategy` 只允许 `inline`、`archive`、`reject`
4. 不允许通过 `..` 或绝对路径逃逸 workflow 根目录
5. 未声明且未被 DSL 显式引用的文件默认不进入 bundle

建议根层声明结构如下：

```json
{
  "resources": [
    {
      "path": "assets/logo.png",
      "usage": "node:render-1:asset",
      "strategy": "archive"
    },
    {
      "path": "prompts/system.md",
      "usage": "node:agent-1:system_prompt",
      "strategy": "inline"
    }
  ]
}
```

其中：

1. `path` 必填，且必须相对 workflow 根目录。
2. `usage` 支持单个字符串或字符串数组，构建时归一化为数组。
3. `strategy` 为可选；未显式声明时由资源分类器按默认阈值自动判定。

### CLI 兼容边界

1. 正式主链路为 `pi-workflow build <workflow-dir>` 与 `pi-workflow run <workflow.pwb>`
2. `run <workflow-dir>` 与 `run <workflow.json>` 默认报错，并明确提示改用 `build`、`run --dir` 或 `run --json`
3. `run --dir <workflow-dir>` 只作为作者态快捷入口，内部仍是“构建临时 `pwb` -> 运行 bundle”
4. JSON 文件仅保留显式兼容入口 `run --json <workflow.json>`；其内部行为也必须收口到“对象态加载 -> 构建临时 `pwb` -> 运行 bundle”
5. 只读检查命令第一阶段优先采用顶级 `inspect <workflow.pwb>`；若后续需要，再兼容 `bundle info` 风格别名
6. `inspect` 不触发执行，仅输出 manifest、document 和 resources 摘要

### CLI 建议参数

1. `build <workflow-dir>`：建议支持 `--out <file>`、`--overwrite`、`--debug`
2. `run <workflow.pwb>`：继续沿用现有 `--mock`、`--pi-extensions`、`--config`、`--debug`
3. `run --dir <workflow-dir>`：仅接受目录输入，建议允许 `--debug` 输出临时 bundle 路径
4. `run --json <workflow.json>`：仅接受 JSON 文件输入，建议允许 `--debug` 输出临时 bundle 路径
5. `inspect <workflow.pwb>`：建议支持 `--json` 结构化输出

### Document 改写边界

1. 已由 `loadFromDirectory()` 展开的 `promptFile`，优先复用现有 `inputs.system_prompt` 内联结果，不重复归档。
2. 第一阶段不自动把任意 `inline` 资源写入任意节点字段，只对已有明确消费语义的文本字段做最小改写。
3. `archive` 资源在 `document.json` 中仅保留 bundle 内稳定引用路径，如 `resources/assets/logo.png`。
4. 第一阶段不尝试在 bundle 层解释图片、音频、PDF 或其他二进制的业务语义。

### 错误模型

新增 `BUNDLE-*` 系列诊断码，至少包含：

1. `BUNDLE-001`：bundle 文件不存在
2. `BUNDLE-002`：`manifest.json` 缺失
3. `BUNDLE-003`：`document.json` 缺失
4. `BUNDLE-004`：`bundleVersion` 不支持
5. `BUNDLE-005`：`kind` 非法
6. `BUNDLE-006`：`document` 哈希不匹配
7. `BUNDLE-007`：资源哈希不匹配
8. `BUNDLE-008`：资源路径非法
9. `BUNDLE-009`：资源超限
10. `BUNDLE-010`：资源未声明且未引用
11. `BUNDLE-011`：重复资源路径
12. `BUNDLE-012`：资源文本解码失败

## 6. 实现路径

1. 新增 `bundle` 模块类型定义与导出入口。
2. 实现 `loadPwbFile()` 与 bundle 结构校验。
3. 实现 `buildPwbFromDirectory()`，复用现有 `loadFromDirectory()` 作为唯一作者态输入。
4. 建立独立 `resources/` 模块，统一资源收集、归档、元数据与读取接口。
5. 先实现最小资源分类器，仅支持大小阈值、UTF-8 文本识别与非法路径拦截。
6. 建立资源收集逻辑，只打包显式引用或显式声明的资源。
7. 提供最小资源访问抽象：`has()`、`readText()`、`readBytes()`、`getMetadata()`。
8. 为 CLI 新增 `build <workflow-dir>` 命令，用目录输入生成 `.pwb`。
9. 调整 `run`，支持运行 `.pwb`，并默认拒绝目录直跑。
10. 为目录输入提供显式参数入口 `run --dir <workflow-dir>`；仅在用户明确声明目录模式时，先构建临时 `pwb` 再运行，结束后默认清理临时产物。
11. 为 JSON 文件输入提供显式兼容入口 `run --json <workflow.json>`；仅在用户明确声明 JSON 模式时，先构建临时 `pwb` 再运行，结束后默认清理临时产物。
12. 为 CLI 新增只读型 `inspect <workflow.pwb>` 命令，输出 manifest、document 与资源摘要。
13. 在 manifest 中预留签名字段，但不在本阶段实现验签与信任链闭环。
14. 补齐成功路径与失败路径测试。
15. 同步开发文档与用户侧说明。

### 建议实现顺序

1. 先定义 `bundle/types.ts`、`bundle/errors.ts` 与 `resources/types.ts`。
2. 实现 `bundle/validator.ts`，先把容器结构与 manifest 校验收口。
3. 实现 `bundle/load.ts`，优先跑通读取与 DSL 复用校验。
4. 实现最小 `bundle/build.ts`，先覆盖 DSL 与小文本资源。
5. 接入 CLI `build`。
6. 接入 CLI `run <workflow.pwb>`。
7. 接入 CLI `run --dir <workflow-dir>`。
8. 补 `inspect <workflow.pwb>` 与资源摘要输出。
9. 最后补资源归档增强、失败路径测试与文档收尾。

## 7. 测试与验收

验收标准：

1. 目录式 workflow 可构建为 `.pwb`。
2. `.pwb` 可在原目录不存在时独立运行。
3. `manifest.json`、`document.json` 缺失或非法时可输出结构化错误。
4. 文本资源可通过统一接口读取。
5. 图片或二进制资源可通过字节接口读取。
6. 未声明资源、资源超限、哈希不匹配时构建或加载失败。
7. CLI 已形成 `build <workflow-dir>` 与 `run <workflow.pwb>` 主链路。
8. `run <workflow-dir>` 与 `run <workflow.json>` 默认被拒绝；仅在 `run --dir <workflow-dir>` 或 `run --json <workflow.json>` 下才允许“先构建临时 `pwb` 再运行”。
9. `inspect <workflow.pwb>` 可输出 manifest、document 与 resources 摘要，且不触发执行。
10. `run --dir <workflow-dir>` 与 `run --json <workflow.json>` 的执行链路都与 `run <workflow.pwb>` 共用同一套 bundle 加载与 runtime 入口。
11. manifest 已包含 `configSnapshot.included = false` 与签名预留字段。
12. 至少覆盖 build、load、run、inspect 四类测试，且包含成功路径与关键失败路径矩阵。
13. `npm run lint` 与 `npm run test:all` 通过。

### 建议测试矩阵

1. `bundle-build.test.ts`：最小 workflow、含 `promptFile` workflow、含图片/二进制资源、超限资源失败、非法路径失败。
2. `bundle-load.test.ts`：正常加载、manifest 缺失、document 缺失、document 哈希篡改、resource 哈希篡改、bundleVersion 非法。
3. `bundle-run.test.ts`：`.pwb` 独立运行、原目录删除后仍可运行、`run --dir` 成功、`run --json` 成功、`run <workflow-dir>` 默认失败、`run <workflow.json>` 默认失败。
4. `bundle-inspect.test.ts`：inspect 不触发执行、可输出 manifest/document/resource 摘要、支持结构化输出。
