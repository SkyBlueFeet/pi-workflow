---
**版本锚点**
- 创建时间：2026-05-27 00:18 +08:00
- 最后更新：2026-05-27 00:18 +08:00
- 代码快照日期：2026-05-27
- Git 分支：main
- Git Commit：79b938d

---

# PWB Bundle 工作流设计分析

## 1. 背景与目标

当前项目已经支持目录式工作流定义：`flow.json + nodes/ + prompts/ + stages/`。这种结构适合作为作者态输入，但不适合作为最终运行输入，因为目录内容可能在移动、复制、协作或运行前后被意外修改。

本方案目标：

1. 设计单文件 `*.pwb` 作为工作流运行态产物。
2. 保留目录导入与编辑能力，但运行时最终只执行 `pwb`。
3. 支持工作流目录中存在多种类型文件，包括文本、二进制、图片与后续未知资源类型。
4. 让运行输入具备稳定性、可传输性、可校验性。

一句话原则：目录是作者态，`pwb` 是交付态，运行时只认 `pwb`。

## 2. 参考代码表

| 文件 | 作用 | 结论 |
|---|---|---|
| `packages/pi-workflow/src/dsl/directory-loader.ts` | 目录式工作流加载入口 | 已具备作者态目录展开能力，可作为 `pwb` 构建输入 |
| `packages/pi-workflow/src/dsl/loader.ts` | 对象式 DSL 加载入口 | 适合作为 bundle 解包后的统一 DSL 校验入口 |
| `packages/pi-workflow/src/dsl/index.ts` | DSL 导出聚合 | 后续可新增 `bundle-loader`/`bundle-builder` 导出 |
| `apps/pi-workflow-cli/src/commands/run.ts` | 当前 CLI 运行入口 | 目前可直接运行目录，后续应逐步收敛为优先运行 `pwb` |
| `packages/pi-workflow/src/config/load.ts` | 配置文件统一加载 | 可为 bundle 构建阶段提供可选配置快照来源 |
| `developers/PLANS/pi-workflow-phases/PLAN_PHASE-6_WORKFLOWDEFINE-IMPORTER.md` | 目录作者态历史设计 | 已明确目录导入为主链路，单文件运行态尚未设计 |

## 3. 核心结论

建议新增 `pwb` 作为单文件 bundle 格式，但不要把它设计成“仅把目录打 zip”。更合适的做法是把它设计成“带清单的归档容器”，其中既保存最终可运行的工作流文档，也保存运行所需资源文件。

推荐分离两层：

1. `authoring source`：目录工作流，允许多文件、多类型资源、相对路径引用。
2. `runtime bundle`：`*.pwb`，不可变、可校验、可独立移动。

`pwb` 的职责不是保留目录结构本身，而是固化“运行时真正依赖的内容”。

## 4. 为什么单纯 JSON bundle 不够

如果工作流只包含 `flow.json` 和少量 prompt 文本，把所有内容展开成一个 JSON 文件可行。但用户已经明确 workflow 下可能有很多文件、很多类型，甚至二进制和图片，此时纯 JSON 内嵌会遇到以下问题：

1. 二进制内容必须转 base64，文件变大明显。
2. 图片、音频、模型模板等资源会让单个 JSON 可读性极差。
3. 大量资源混入 DSL 文档，不利于校验与调试。
4. 未来若加入签名、增量校验、资源去重，纯 JSON 结构扩展性差。

因此更推荐：`pwb` 是“容器文件”，内部包含 manifest 与资源区，而不是简单 JSON 文档。

## 5. 推荐的 PWB 结构

建议 `pwb` 逻辑上包含三部分：

1. `manifest.json`
2. `document.json`
3. `resources/*`

逻辑目录示例：

```text
example.pwb
  manifest.json
  document.json
  resources/
    prompts/system.md
    assets/logo.png
    binaries/tool.bin
```

物理封装先不强行定为自定义二进制格式，建议优先使用成熟归档容器：

1. 第一优先：zip 容器，文件后缀仍为 `.pwb`
2. 容器内部固定上述结构
3. MIME / 内容标识由 `manifest.json` 定义

这样做的好处：

1. 天然支持二进制文件。
2. 天然支持目录层级与大量资源。
3. 不需要把图片和二进制全部转 base64。
4. 后续可增加签名文件、摘要文件、编译缓存文件。

## 6. Manifest 设计

建议 `manifest.json` 作为 bundle 的稳定元信息入口。

建议字段：

```json
{
  "kind": "pi-workflow-bundle",
  "bundleVersion": "1",
  "workflow": {
    "id": "demo-flow",
    "title": "Demo Flow",
    "version": "1.0.0"
  },
  "source": {
    "type": "directory",
    "entry": "flow.json",
    "builtAt": "2026-05-27T00:18:00+08:00"
  },
  "document": {
    "path": "document.json",
    "sha256": "..."
  },
  "resources": [
    {
      "path": "resources/prompts/system.md",
      "sourcePath": "prompts/system.md",
      "mediaType": "text/markdown",
      "encoding": "utf-8",
      "sha256": "...",
      "size": 1234,
      "usage": ["node:agent-1:system_prompt"]
    },
    {
      "path": "resources/assets/logo.png",
      "sourcePath": "assets/logo.png",
      "mediaType": "image/png",
      "sha256": "...",
      "size": 28412,
      "usage": ["node:render-1:asset"]
    }
  ],
  "configSnapshot": {
    "included": false
  }
}
```

关键点：

1. `document` 与每个 `resource` 都有独立哈希。
2. `usage` 记录资源被谁引用，便于调试和裁剪。
3. `sourcePath` 保留作者态路径，便于回溯。
4. `bundleVersion` 单独版本化，避免与 workflow 自身版本混淆。

## 7. Document 设计

`document.json` 建议保存“最终可运行 DSL 文档”，而不是原始目录输入。

构建阶段建议完成：

1. 展开 `nodeFiles`
2. 展开 `subWorkflowDir`
3. 应用目录继承规则
4. 解析所有文本类 `promptFile`
5. 将资源引用从作者态相对路径改写为 bundle 内资源路径或资源 ID

这里要区分两类资源：

1. `内联型资源`
2. `归档型资源`

### 7.1 内联型资源

适合直接写入 `document.json`：

1. 小型文本 prompt
2. 小型 JSON 模板
3. 运行必须立即读取的短文本

例如当前 `promptFile -> system_prompt` 的处理，本质就属于内联型。

### 7.2 归档型资源

适合保留为独立资源文件：

1. 图片
2. 音频
3. PDF
4. 二进制
5. 大文本
6. 未来插件或工具所需的附件文件

这些资源不应直接塞进 `document.json`，而应通过资源引用来访问。

## 8. 资源分类策略

为避免处理变复杂，建议不要按文件后缀硬编码业务逻辑，而是按“构建策略”分类。

建议定义三种资源策略：

1. `inline`
2. `archive`
3. `reject`

### 8.1 inline

适用：

1. UTF-8 文本
2. 小于阈值，例如 `64KB`
3. 明确被 DSL 字段内联消费的内容

行为：

1. 内容写入 `document.json`
2. 可选同时在 `manifest` 记录来源文件与哈希

### 8.2 archive

适用：

1. 二进制
2. 图片
3. 大文本
4. 非 UTF-8 文件
5. 无法安全内联的任意资源

行为：

1. 原样写入 `resources/`
2. `document.json` 只保留引用
3. 运行时通过 bundle 资源读取接口访问

### 8.3 reject

适用：

1. 超过体积上限的文件
2. 被策略明确禁止的文件类型
3. 构建时无法确定用途且又不在允许清单中的资源

行为：

1. 构建失败
2. 输出结构化诊断，指出文件路径、大小、原因

这样可以防止用户把整个缓存目录、虚拟环境、模型权重或无关大文件误打进 bundle。

## 9. 二进制与图片如何处理

这是本方案的关键。

建议规则：二进制和图片默认都走 `archive`，不做特殊业务解释。

也就是说系统不需要在第一阶段理解“这是不是图片”“是不是可显示资源”，只需要保证：

1. 能被打入 `pwb`
2. 有稳定路径
3. 有哈希
4. 运行时可被按字节读取

这样设计的好处是边界清晰：

1. bundle 层只负责封装与校验。
2. 真正理解图片/二进制语义的是上层 executor、tool 或插件。
3. 不把媒体处理逻辑耦合进核心工作流 loader。

建议运行时提供统一资源访问抽象，例如：

```ts
interface WorkflowBundleResourceReader {
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

这样 executor 如果需要图片或二进制，可以按需读取，不必关心资源来自目录还是 bundle。

## 10. 导入文件夹的设计边界

用户希望“支持导入文件夹，只不过最终运行时是运行 bundle 文件”。建议把“导入文件夹”定义为“构建输入采集流程”，而不是运行能力。

建议 CLI 语义：

1. `pi-workflow build <workflow-dir>`
2. `pi-workflow run <workflow.pwb>`

可选兼容：

1. `pi-workflow run <workflow-dir> --build`

其内部行为应等价于：

1. 从目录构建临时 `pwb`
2. 运行临时 `pwb`
3. 运行日志中明确说明实际运行的是 bundle

但默认模式下不建议直接运行目录。

## 11. 需要新增的作者态声明能力

因为 workflow 下可能有很多文件，系统不能靠“扫描整个目录并全部打包”来猜哪些资源需要进入 bundle。这样容易把无关文件一起带入。

建议增加显式资源声明机制，例如在 `flow.json` 或节点定义中增加：

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

推荐原则：

1. 默认只打包被 DSL 显式引用的文件。
2. 目录扫描只作为开发辅助，不作为默认生产行为。
3. 未声明且未被引用的文件默认不进入 bundle。

这样才能防止“工作流目录很多文件、很多类型”时打包结果失控。

## 12. 运行时安全与稳定性收益

采用 `pwb` 后，运行稳定性主要体现在：

1. 运行输入冻结，不再依赖作者态目录即时状态。
2. 每个资源可校验哈希，可检测传输后损坏或篡改。
3. 单文件更容易移动、分发、缓存与归档。
4. bundle 内部结构固定，便于后续做签名与可信加载。

## 13. 分阶段落地建议

### 阶段 A：最小可用

目标：先支持文本资源 + 归档容器。

1. 定义 `manifest.json` 与 `document.json`
2. 定义 `*.pwb` 为 zip 容器
3. 实现 `buildPwbFromDirectory()`
4. 实现 `loadPwbFile()`
5. 支持当前 `promptFile` 与目录展开能力写入 bundle
6. CLI 增加 `build <workflow-dir>` 与 `run <pwb>`

### 阶段 B：资源归档增强

目标：支持图片、二进制、大文本。

1. 引入 `resources` manifest
2. 引入 `archive/inline/reject` 策略
3. 提供运行时 `resourceReader`
4. 增加体积限制、哈希校验、重复资源检测

### 阶段 C：运行入口收口

目标：运行时全面转向 bundle。

1. `run` 默认拒绝目录
2. 目录仅作为 build 输入
3. 提供 `--build` 开发快捷模式
4. 文档明确作者态与运行态边界

## 14. 不建议的方案

### 14.1 不建议直接把整个目录 JSON 化

原因：

1. 不适合二进制
2. 文件体积膨胀
3. manifest 与资源边界不清晰

### 14.2 不建议运行时继续回读原目录

原因：

1. 违背“防止意外修改”的初衷
2. 运行结果不稳定
3. 无法保证 bundle 可独立迁移

### 14.3 不建议默认全目录打包

原因：

1. 工作流目录可能混入大量无关文件
2. 容易把敏感文件、缓存文件、临时文件带入产物
3. 不利于构建结果可预测

## 15. 最终建议

结论如下：

1. `pwb` 应定义为单文件 bundle 容器，而不是简单 JSON 文件。
2. 第一阶段容器实现建议直接采用 zip，后缀使用 `.pwb`。
3. bundle 内固定包含 `manifest.json`、`document.json`、`resources/`。
4. 文本小资源可 `inline`，图片和二进制默认 `archive`。
5. 运行时只执行 `pwb`，目录只作为构建输入。
6. 默认只打包显式引用或显式声明的资源，不做全目录自动收集。

这套设计能兼顾：

1. 方便移动和传输
2. 防止意外修改
3. 支持多文件和多类型资源
4. 给后续签名、校验、缓存和分发留出演进空间

## 16. 后续实现建议

建议后续代码改动顺序：

1. 在 `packages/pi-workflow/src` 下新增 `bundle/` 模块
2. 定义 `WorkflowBundleManifest`、`WorkflowBundleResource`、`WorkflowBundleLoadResult`
3. 实现目录到 `pwb` 的构建器
4. 实现 `pwb` 到 `WorkflowDslDocument` 的加载器
5. 调整 CLI，使 `run` 优先支持 `pwb`
6. 再补资源声明语法与二进制资源读取接口
