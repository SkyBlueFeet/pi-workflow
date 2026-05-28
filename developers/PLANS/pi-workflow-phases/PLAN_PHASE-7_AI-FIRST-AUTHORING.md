---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 18:40 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 7：AI-First Authoring

## 1. 最终实现目标

阶段 7 完成后，用户应能通过自然语言生成、检查和修复 workflow 草案。

目标能力：

1. 生成 workflow DSL 草案。
2. lint workflow。
3. 根据 diagnostics 修复 workflow。
4. 管理 workflow template。
5. 渲染 workflow 摘要。
6. 执行 runtime dry-run。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. Authoring 是否直接依赖 PI Agent。
2. Authoring host contract。
3. 模板库格式。
4. 生成质量评估标准。
5. fixer 自动修改边界。
6. dry-run 的行为范围：
   - 只校验结构。
   - 执行 deterministic 节点。
   - mock agent/tool。
7. 生成 prompt 与示例库维护方式。

## 3. 当前已进行工作

已完成：

1. 架构文档已定义 Authoring Layer。
2. 总览计划已列出 `WorkflowDraftGenerator`、`WorkflowLinter`、`WorkflowFixer`、`WorkflowTemplateRegistry`、`WorkflowRenderer`。
3. DSL/IR/runtime 的前置阶段已规划为 authoring 的稳定基础。
4. ✅ `WorkflowDraftGenerator` 与 `WorkflowAuthoringHost` contract 已实现。
5. ✅ `RuleBasedWorkflowAuthoringHost` 已实现，可在无模型环境下根据 prompt 生成可 lint 的最小 DSL 草案。
6. ✅ `WorkflowLinter` 已实现，覆盖不可达节点、空复合节点、缺失输入策略等 authoring 诊断。
7. ✅ `WorkflowFixer` 已实现，支持确定性删除不可达节点与空复合节点，不做猜测性接线。
8. ✅ `WorkflowTemplateRegistry` 已实现，支持目录式模板元数据和 workflow 加载。
9. ✅ `WorkflowRenderer` 已实现，可输出面向人类阅读的 workflow 摘要。
10. ✅ `WorkflowDryRunner` 已实现，执行 deterministic 节点并对 `agent/tool/http` 给出 warning。
11. ✅ `evaluateWorkflowDrafts()` 已实现，提供 NL-to-DSL eval fixture 回归入口。
12. ✅ authoring 测试覆盖 linter、fixer、renderer、template registry、dry-run、draft-generator、eval-runner。

待后续增强：

1. 接入真实 PI/LLM authoring host，复用当前 `WorkflowAuthoringHost` contract。
2. 扩展 NL-to-DSL eval fixture 规模和质量指标。
3. 补充可维护的 authoring prompt 示例库。

## 4. 目录设计

```text
src/authoring/
  types.ts
  draft-generator.ts
  linter.ts
  fixer.ts
  template-registry.ts
  renderer.ts
  dry-run.ts
  rule-based-host.ts
  eval-runner.ts
test/authoring/
  linter.test.ts
  fixer.test.ts
  template-registry.test.ts
  dry-run.test.ts
  draft-generator.test.ts
  eval-runner.test.ts
test/fixtures/authoring/
  prompts/
  templates/
  expected/
```

## 5. 结构设计

Authoring host：

```ts
export interface WorkflowAuthoringHost {
  generateDraft(request: WorkflowDraftRequest): AsyncGenerator<WorkflowHostEvent, WorkflowDraftResult>;
}
```

当前实现边界：

1. `WorkflowDraftGenerator` 只依赖 `WorkflowAuthoringHost`，不直接依赖 PI Agent。
2. `RuleBasedWorkflowAuthoringHost` 是无模型环境的确定性 baseline，用于生成最小可校验草案和 eval smoke。
3. 后续真实 PI/LLM host 应实现同一 contract，不改变 authoring 工具链。

Lint result：

```ts
export interface WorkflowLintResult {
  diagnostics: WorkflowDiagnostic[];
  suggestedFixes: WorkflowSuggestedFix[];
}
```

## 6. 实现路径

1. ✅ 实现 deterministic linter。
2. ✅ 实现 template registry。
3. ✅ 实现 renderer。
4. ✅ 实现 rule-based fixer。
5. ✅ 接入 authoring host contract。
6. ✅ 接入 validator 与 dry-run。
7. ✅ 建立 NL-to-DSL 评测样例入口。
8. ✅ 提供本地规则式 authoring host 作为无模型 baseline。

## 7. 测试与验收

验收标准：

1. ✅ linter/fixer/template 测试稳定。
2. ✅ 生成型测试使用 mock host 与本地规则 host。
3. ✅ 生成结果可 validator 或返回 diagnostics。
4. ✅ fixer 能根据 diagnostics 修改 DSL。
5. ✅ dry-run 能发现缺失输入、无效引用和不可达节点。
6. ✅ NL-to-DSL eval runner 可验证生成草案的节点类型和 error diagnostics。
7. ⏳ 真实 PI/LLM authoring host 作为后续增强，不阻塞阶段 7 当前验收。
