---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 18:40 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 6：目录加载器与文件化 DSL

## 1. 最终实现目标

阶段 6 完成后，系统应能通过目录结构加载 workflow 定义，支持外部文件引用和嵌套子工作流。当前阶段以新格式定义为准，不再把旧格式迁移命令作为目标能力。

目标能力：

1. 读取 `flow.json` 为工作流根定义。
2. 通过 `nodeFiles` 引用外部节点文件。
3. 通过 `promptFile` 加载外部 prompt 内容。
4. 支持简单节点（单文件）和复杂节点（目录 + 资源文件）。
5. 支持目录嵌套子工作流。
6. 所有加载后的文档可通过现有 validator 和 mapper。
7. 明确当前导入入口仅支持目录式结构；单文件导入导出留待后续阶段讨论。

## 2. 前置讨论与待确定

1. 子工作流如何通过 `stages/` 引用。
2. `$schema` 引用与验证集成。
3. 允许多少层目录嵌套。
4. 当前导入边界：仅支持目录式 `flow.json + nodes/ + prompts/ + stages/` 结构。
5. 单文件导入导出如何设计，后续按真实需求再定，不作为本阶段准入项。

## 3. 当前已进行工作

已完成：

1. ✅ `src/dsl/file-resolver.ts` — 文件路径解析与读取工具
2. ✅ `src/dsl/directory-loader.ts` — 目录加载器（读 flow.json + 合并 nodeFiles + 解析 promptFile）
3. ✅ `test/fixtures/dir-flow/` — 目录格式 fixture（flow.json + nodes/return.json）
4. ✅ `test/fixtures/dir-flow-with-prompt/` — 含 promptFile 引用的 fixture
5. ✅ `test/fixtures/nested-flow/` — `subWorkflowDir` 递归展开 fixture
6. ✅ `test/fixtures/complex-node-flow/` — 目录节点 + 外部资源 fixture
7. ✅ `test/dsl/directory-loader.test.ts` — 9 个测试：加载验证 + mapper 集成 + runtime 执行 + 错误处理 + promptFile 解析 + 嵌套子工作流 + 复杂目录节点
8. ✅ 已验证目录式 loader 可独立支撑当前新格式定义主链路。
9. ✅ `$schema` 引用与版本兼容校验已集成。
10. ✅ CLI `run` / `trace` / `inspect` 已支持目录式 workflow。

待后续增强：

1. 单文件导入导出方案设计。
2. 旧 `WorkflowDefine -> pi-native DSL` renderer 或迁移命令按真实需求另行设计。

## 4. 目录设计

```text
src/dsl/
  directory-loader.ts      # 目录加载器
  file-resolver.ts         # 文件解析工具
test/dsl/
  directory-loader.test.ts
test/fixtures/
  dir-flow/                # 目录格式 fixture
    flow.json
    nodes/
      return.json
  dir-flow-with-prompt/    # promptFile fixture
    flow.json
    prompts/
      system.md
  nested-flow/             # 嵌套子工作流 fixture
  complex-node-flow/       # 目录节点 fixture
```

## 5. 结构设计

### 目录结构规范

```
my-workflow/
  flow.json                # 工作流根定义（必选）
  nodes/                   # 节点文件目录（可选）
    step-1.node.json       # 单文件节点
    step-2/                # 目录节点
      node.json            # 节点定义
      prompts/             # 外部资源
        system.md
  stages/                  # 子工作流目录（可选，预留）
    sub-flow/
      flow.json
      nodes/
        ...
  prompts/                 # 共享 prompt 目录（可选）
    common.md
```

### DirectoryLoadResult

```ts
export interface DirectoryLoadResult {
  document: WorkflowDslDocument;
  diagnostics: WorkflowDiagnostic[];
  resolvedFiles: string[];
}
```

### 最简配置与继承规则

目录式 `flow.json` 允许按最简配置填写，但该能力只适用于“设置与策略”类字段，不适用于节点业务语义字段。

继承优先级：

1. 节点显式值。
2. 当前目录 `flow.json.defaults`。
3. 父目录继承下来的 defaults。
4. 系统默认值。

当前允许继承或补全的字段：

1. `version`
2. `defaults.executor`
3. `defaults.control`
4. `defaults.missingInput`
5. `resources`
6. `settings`
7. `title`（缺失时回退到 `id` 或目录名）
8. `entry`（缺失时仅在存在唯一无入边节点时自动推导）

当前明确不继承的字段：

1. `inputs`
2. `output`
3. `dependsOn`
4. `children`

以上字段必须由节点显式定义，避免目录层级加深后语义变得不透明。

## 6. 实现路径

1. ✅ 实现 `FileResolver` 基础文件读取。
2. ✅ 实现 `loadFromDirectory` 核心逻辑。
3. ✅ 外部节点文件合并（`nodeFiles`）。
4. ✅ `promptFile` 内容读取与注入。
5. ✅ 实现 `subWorkflowDir` 递归加载并将子工作流节点平铺到当前文档。
6. ✅ 编写复杂节点目录 fixture。
7. ✅ 编写目录嵌套测试。
8. ✅ 集成 `$schema` 兼容校验。
9. ✅ 装配 CLI 目录式 workflow 加载入口。
10. 后续按需要评估单文件导入导出，不作为当前阶段实现项。

## 7. 测试与验收

验收标准：

1. ✅ `flow.json` 所在目录可加载为完整 `WorkflowDslDocument`。
2. ✅ `nodeFiles` 中的外部节点文件被正确合并。
3. ✅ `promptFile` 内容被读取并注入 `system_prompt`。
4. ✅ 加载后的文档可通过 mapper → runtime 完整执行。
5. ✅ 缺失 `flow.json` 时输出结构化错误诊断（`DIR-001`）。
6. ✅ 子工作流目录可递归加载并保持依赖关系稳定。
7. ✅ 当前新格式 workflow 目录可以作为唯一正式导入入口稳定使用。
8. ✅ 目录式最简配置可通过继承补全设置/策略字段，但不会隐式继承节点业务字段。
9. ✅ CLI 可直接运行和调试目录式 workflow。
10. ✅ `$schema` 不兼容时可输出结构化诊断。
11. ⏳ 单文件导入导出暂未支持，留待后续阶段讨论。
