---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 10:00 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 1：pi-native DSL 与 Workflow IR v0

## 1. 最终实现目标

阶段 1 完成后，系统应具备第一版可校验、可转换、可测试的 workflow 定义层。

目标能力：

1. 定义 `pi-native DSL` v0。
2. 定义 `Workflow IR` v0。
3. 定义 `ValueRef` 统一数据引用模型。
4. 实现 DSL loader、schema validator、引用 validator。
5. 实现 `DSL -> IR` mapper。
6. 建立至少三个 fixture 与 golden IR。
7. 明确每类节点的 runtime capability 标注。
8. 为后续 runtime 提供稳定输入。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. `resources` 第一版扩展入口如何透传到 IR metadata。
2. agent 节点能力引用在阶段 1 的占位策略：
   - 只保留 `executor`/`capabilities` metadata。
   - 或对未知 PI 字段输出 warning diagnostic。
3. `prompt.from = "pi.prompt"`、agent `skills/tools`、`resources.piPackages` 是否全部推迟到阶段 4 定稿。
4. `ValueRef.path` 第一版路径语法：
   - 点路径。
   - JSON Pointer。
   - JSONPath。
5. DSL schema 实现方式：
   - `typebox`。
   - JSON Schema。
   - 手写 validator。
6. node id 命名规则和重复检测策略。
7. `workflow.children` 与 `dependsOn` 的关系：
   - children 只表达结构。
   - dependsOn 表达执行顺序。
   - mapper 是否自动从 children 推导 edges。
8. v0 节点 runtime 支持范围：
   - `manual/workflow/return` 在阶段 2 执行。
   - `agent` 在阶段 4 前只支持 DSL/IR 转换与 unsupported diagnostic。

## 3. 当前已进行工作

已完成：

1. 架构文档已定义 DSL、IR、ValueRef 的目标形态。
2. 总览计划已列出 `workflow`、`agent`、`manual`、`return` 四类 v0 节点，并明确 `agent` 在阶段 4 前只接入为 PI-backed 执行能力。
3. 总览计划已明确阶段 1 只保留 PI resource/capability 扩展占位，`resources.piPackages` 在阶段 4 定稿。
4. 总览计划已明确 `WorkflowDefine` importer 暂不作为主 DSL。

已完成（代码已落地）：

1. ✅ DSL schema 文件：`src/dsl/schema.ts`
2. ✅ DSL 类型定义：`src/dsl/types.ts`
3. ✅ DSL fixture：`test/fixtures/dsl/`（minimal-return / manual-artifact / subworkflow）
4. ✅ golden IR fixture：`test/fixtures/ir/`（对应三组 golden）
5. ✅ ValueRef 定义：`src/dsl/value-ref.ts`
6. ✅ IR 类型定义：`src/ir/types.ts`
7. ✅ DSL loader：`src/dsl/loader.ts`
8. ✅ 引用 validator：`src/dsl/validator.ts`
9. ✅ DSL → IR mapper：`src/dsl/mapper.ts`
10. ✅ IR normalize：`src/ir/normalize.ts`
11. ✅ IR graph：`src/ir/graph.ts`
12. ✅ diagnostics codes：`src/dsl/diagnostics.ts` + `src/ir/diagnostics.ts`
13. ✅ mapper golden tests 通过（3 fixtures）

## 4. 目录设计

新增或完善：

```text
src/dsl/
  types.ts
  schema.ts
  loader.ts
  validator.ts
  mapper.ts
  diagnostics.ts
  value-ref.ts
src/ir/
  types.ts
  graph.ts
  normalize.ts
  diagnostics.ts
test/dsl/
  loader.test.ts
  validator.test.ts
  mapper.test.ts
test/fixtures/dsl/
  minimal-return.workflow.json
  manual-artifact.workflow.json
  subworkflow.workflow.json
test/fixtures/ir/
  minimal-return.ir.json
  manual-artifact.ir.json
  subworkflow.ir.json
```

## 5. 结构设计

核心类型：

```ts
export interface WorkflowDslDocument {
  id: string;
  version: string;
  title: string;
  entry: string;
  nodes: WorkflowDslNode[];
  defaults?: WorkflowDslDefaults;
  resources?: WorkflowDslResources;
  settings?: WorkflowDslSettings;
}
```

```ts
export type ValueRef =
  | { from: "run.input"; path?: string }
  | { from: "context"; path?: string }
  | { from: "node.output"; nodeId: string; path?: string }
  | { from: "frame.local"; path?: string }
  | { from: "literal"; value: unknown };
```

```ts
export interface WorkflowDefinitionIR {
  id: string;
  version: string;
  title: string;
  entryNodeIds: string[];
  nodes: WorkflowNodeIR[];
  edges: WorkflowEdgeIR[];
  finalOutput?: WorkflowOutputBindingIR;
}
```

诊断结构：

```ts
export interface WorkflowDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
  nodeId?: string;
}
```

## 6. 实现路径

1. 定义 DSL 类型。
2. 定义 ValueRef。
3. 定义 IR 类型。
4. 实现 schema validator。
5. 实现引用 validator。
6. 实现 DSL loader。
7. 实现 `DSL -> IR` mapper。
8. 定义节点 runtime capability 元数据或 diagnostic 规则；PI-backed capability 字段只做占位、透传或 warning。
9. 编写三个 DSL fixture。
10. 编写三个 golden IR fixture。
11. 编写 loader、validator、mapper 测试。

## 7. 测试与验收

验收标准：

1. 三个 fixture 可稳定转换为 IR。
2. 缺失 entry 能输出结构化诊断。
3. 重复 node id 能输出结构化诊断。
4. 无效 ValueRef 能输出结构化诊断。
5. 无效 dependsOn 能输出结构化诊断。
6. `ir` 模块不依赖 `dsl` 模块。
7. `agent` fixture 只要求 DSL/IR 转换正确，不要求阶段 2 runtime 可执行。
8. `resources.piPackages`、`prompt.from = "pi.prompt"`、agent `skills/tools` 不作为阶段 1 验收项，正式字段结构进入阶段 4。
