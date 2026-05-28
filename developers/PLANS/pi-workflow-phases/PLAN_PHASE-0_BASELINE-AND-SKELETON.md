---
**版本锚点**
- 创建时间：2026-05-26 10:00 +08:00
- 最后更新：2026-05-26 18:40 +08:00
- 代码快照日期：2026-05-26

---

# 阶段 0：基线与工程骨架

## 1. 最终实现目标

阶段 0 完成后，当前仓库应具备一个可构建、可测试、可继续扩展的独立 npm 工程骨架。

目标能力：

1. 建立根 npm workspace。
2. 建立 `packages/pi-workflow` 核心包。
3. 建立 `apps/pi-workflow-cli` 命令行入口。
4. 建立 TypeScript、Vitest、build/test 脚本。
5. 建立空模块出口和 fixture 目录。
6. 建立 PI npm adapter 的模块入口。
7. 完成 PI npm 包、ResourceLoader、package manifest、extension/tool/skill/prompt 发现机制的初步调研记录。
8. 建立 PI agent mock spike；真实 AgentSession 闭环若受凭据或 API 稳定性影响，可记录 blocked，不阻塞阶段 1-3。
9. 初始化 CodeGraph 索引，或在失败时记录明确 blocked 原因与重试命令。

## 2. 前置讨论与待确定

进入开发前需要确定：

1. 包管理方式：npm workspace、pnpm workspace 或单包结构。
2. 核心包名：是否使用 `@pi-workflow/core`。
3. CLI 名称：是否使用 `pi-workflow`。
4. PI npm 依赖候选清单：
   - Agent runtime 入口。
   - ResourceLoader 入口。
   - Session/checkpoint 入口。
   - Tool 与 extension 注册入口。
5. PI agent mock spike 范围：
   - 模拟提交单次 prompt/input。
   - 模拟收集事件流。
   - 生成最小文本或 JSON artifact。
   - 记录真实 AgentSession 调用所需的依赖、凭据和待确认 API。
6. lockfile 与依赖版本固定策略。

不作为阶段 0 准入项：

1. PI package source 支持范围。
2. 第三方 PI package 使用策略。
3. package trust policy。
4. PI npm 正式依赖入口定稿。
5. 真实 AgentSession 端到端调用闭环。

以上内容推迟到阶段 4 开始开发前确认。

## 3. 当前已进行工作

文档层面已完成：

1. `../../pi-workflow-architecture.md` 已定义系统架构。
2. `../../pi-workflow-evolution.md` 已定义演进路线。
3. `../PLAN_PI-WORKFLOW-DEVELOPMENT.md` 已形成总览计划。
4. 已明确 `pi-workflow` 作为当前仓库独立 npm 工程推进。
5. 已明确 PI 是外部 npm 能力基座。
6. 已明确 `src/adapters/pi` 是正式 PI npm adapter 模块。
7. 已补充 PI 生态能力包接入模型。

> 注：以上为文档定义工作，属于阶段规划产出；阶段 0 的工程代码实现已完成，历史待办保留为验收依据。

已完成：

1. ✅ CodeGraph 索引已初始化并可查询。
2. ✅ PI npm SDK 初步调研记录已形成：`developers/ANALYSIS/PI_NPM_SDK_RESEARCH.md`。
3. ✅ PI agent mock spike 已建立；真实 AgentSession 因内部私有包入口限制继续按 blocked 处理。
4. ✅ npm workspace、核心包、CLI、TypeScript build、Vitest 测试入口已建立。

## 4. 目录设计

新增：

```text
package.json
tsconfig.base.json
vitest.config.ts
packages/pi-workflow/
  package.json
  tsconfig.build.json
  vitest.config.ts
  README.md
  src/
    index.ts
    dsl/index.ts
    ir/index.ts
    runtime/index.ts
    executors/index.ts
    artifacts/index.ts
    events/index.ts
    store/index.ts
    host/index.ts
    adapters/pi/index.ts
  test/fixtures/
    dsl/
    ir/
    runtime/
  examples/
    pi-agent-smoke.ts
apps/pi-workflow-cli/
  package.json
  src/cli.ts
```

## 5. 结构设计

`packages/pi-workflow/src/index.ts` 暴露核心模块：

```ts
export * from "./dsl/index.js";
export * from "./ir/index.js";
export * from "./runtime/index.js";
export * from "./host/index.js";
export * from "./adapters/pi/index.js";
```

根工程负责：

- workspace 管理。
- 统一 build/test。
- 依赖版本固定。
- CLI app 与核心包的本地引用。

## 6. 实现路径

1. ✅ 初始化 CodeGraph 索引；如果当前环境无法初始化，记录 blocked 原因、失败命令和下一步重试命令。
2. ✅ 创建根 `package.json`、`tsconfig.base.json`、`vitest.config.ts`。
3. ✅ 创建 `packages/pi-workflow` 核心包。
4. ✅ 创建 `apps/pi-workflow-cli` 入口。
5. ✅ 配置 TypeScript build。
6. ✅ 配置 Vitest。
7. ✅ 建立空模块出口。
8. ✅ 添加 README。
9. ✅ 添加 PI npm adapter 模块入口。
10. ✅ 建立 fixture 目录。
11. ✅ 建立 PI agent mock spike。
12. ✅ 记录 PI npm SDK 初步调研结果与 spike/blocked 结果。
13. ✅ 运行 install/build/test。

## 7. 测试与验收

验收命令：

```bash
npm run build
npm test
```

验收标准：

1. ✅ 核心包可构建。
2. ✅ CLI app 可被 workspace 发现。
3. ✅ 测试入口不阻塞根工程 test。
4. ✅ PI npm adapter 模块可被导入。
5. ✅ PI npm SDK 初步调研记录已形成。
6. ✅ CodeGraph 已初始化并可查询。
7. ✅ PI agent mock spike 已有可运行脚本；真实 AgentSession 闭环如未满足，已有明确 blocked 记录。
