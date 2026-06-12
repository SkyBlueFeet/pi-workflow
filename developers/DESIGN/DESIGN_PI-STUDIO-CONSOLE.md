---
**版本锚点**
- 创建时间：2026-06-12 22:10 +08:00
- 最后更新：2026-06-12 22:18 +08:00
- 代码快照日期：2026-06-12
- Git 分支：main
- Git Commit：3c5d663
---

# 设计：pi-studio 宿主级控制台

## 1. 背景

当前仓库已经具备以下能力：

1. `pi-workflow` CLI 已形成 workflow 的运行、恢复、检查和调试主链路。
2. `pi-agent` 与 `pi-workflow agent run` 已形成独立 agent 的 `pi-tui` 运行面。
3. workflow display shell 已形成统一展示入口，后续可继续演进为更完整的交互式 TUI。
4. `pi-workflow-web` 已形成独立前端工程，可用于可视化 workflow 编辑。
5. authoring、registry、resolver、resource loader、tool bridge、权限模型等底层能力已具备复用基础。

当前缺少的是一个产品级宿主入口，用于统一承载：

1. 系统对象浏览
2. AI 辅助创作
3. workflow 与 agent 的执行入口
4. 内置 skill、tool、resource 的可见性与操作入口

## 2. 已有基础

`pi-studio` 不是从零开始的新系统，而是对现有模块的产品级装配。

### 2.1 现有命令

1. `pi-workflow`
   - workflow 运行与调试命令行入口
2. `pi-agent`
   - 独立 agent 命令行入口
3. `pi-workflow agent ...`
   - 当前 workflow CLI 中的 agent 子命令入口

### 2.2 现有模块

1. agent 装配与运行：
   - `packages/pi-workflow/src/agents/`
   - `packages/pi-workflow/src/adapters/pi/pi-tui-agent-runner.ts`
2. workflow 运行与显示：
   - `apps/pi-workflow-cli/src/runtime/`
   - `apps/pi-workflow-cli/src/workflow-runner/`
   - `apps/pi-workflow-cli/src/display/`
3. workflow authoring：
   - `packages/pi-workflow/src/authoring/`
4. skill / tool / resource 加载：
   - `packages/pi-workflow/src/adapters/pi/skill-loader.ts`
   - `packages/pi-workflow/src/adapters/pi/package-resource-loader.ts`
   - `packages/pi-workflow/src/adapters/pi/extension-catalog.ts`

### 2.3 产品化缺口

现有能力已经覆盖“运行”与“底层装配”，但尚未形成统一的宿主控制台来：

1. 浏览已有 workflow、agent、skill、tool、resource
2. 用 AI 生成 workflow 与 agent 草稿
3. 以宿主命令统一承载 catalog、创作、执行与诊断

## 3. 产品形态

### 3.1 对外命令形态

`pi-studio` 作为新增产品命令，引入以下命令形态：

```text
pi-studio
  -> 显示 help

pi-studio --console
  -> 进入宿主级控制台
```

现有外部命令继续保留：

```text
pi-workflow ...
  -> workflow CLI 入口

pi-agent ...
  -> 独立 agent CLI 入口
```

### 3.2 正式定型的 CLI 命令

阶段 15 完成后，对外 CLI 命令集合固定为三组：

1. `pi-studio`
   - 产品级宿主入口
   - 默认显示 help
   - `--console` 进入宿主级控制台
2. `pi-workflow`
   - workflow 运行、恢复、检查、调试入口
   - 继续承载 run / resume / inspect / trace / build 等 workflow 命令
3. `pi-agent`
   - 独立 agent 入口
   - 继续承载 list / show / resolve / run / once 等 agent 命令

这三组命令的关系为：

1. `pi-studio` 负责宿主控制台和产品级组织入口
2. `pi-workflow` 负责 workflow 专项命令
3. `pi-agent` 负责独立 agent 专项命令

### 3.3 CLI help 口径

阶段 15 完成后，三组 CLI 的 help 文案应稳定为以下口径：

#### `pi-studio`

```text
pi-studio
  产品级宿主入口

用法:
  pi-studio --console

说明:
  默认显示帮助信息
  --console 进入宿主级控制台

相关命令:
  pi-workflow   workflow 运行与调试入口
  pi-agent      独立 agent 入口
```

#### `pi-workflow`

```text
pi-workflow
  workflow 专项命令入口

说明:
  继续承载 run / resume / inspect / trace / build 等 workflow 命令
```

#### `pi-agent`

```text
pi-agent
  独立 agent 专项命令入口

说明:
  继续承载 list / show / resolve / run / once 等 agent 命令
```

### 3.4 控制台形态

`pi-studio --console` 进入一个宿主级控制台，该控制台具备两层能力：

1. Shell
   - 负责 slash command、视图切换、列表展示、动作确认和执行接线
2. Assistant Agent
   - 负责自然语言理解、草稿生成、修复建议和结构化动作建议

### 3.5 控制台特殊 agent

控制台内嵌一个特殊 agent：

1. 逻辑名称：`studio-console`
2. 来源：仓库内置 agent 文件
3. 作用：作为控制台内的 AI 助手
4. 能力：读取系统对象、分析上下文、生成 workflow 与 agent 草稿、给出结构化动作建议

## 4. 控制台功能模型

### 4.1 Catalog 功能

控制台第一阶段提供六类 catalog：

1. Workflows
2. Agents
3. Skills
4. Tools
5. Resources
6. Runs

每类 catalog 统一支持：

1. 列表
2. 详情
3. 来源信息
4. 与执行链路的跳转入口

### 4.2 Create 功能

控制台第一阶段提供两个创作入口：

1. `/create-workflow`
2. `/create-agent`

两者都走统一的“草稿生成 -> 预览 -> 校验 -> 确认 -> 落盘”链路。

### 4.3 Execute 功能

控制台提供以下执行入口：

1. workflow run / resume / inspect / trace
2. agent resolve / run
3. 最近运行与可恢复 run 查看

### 4.4 Assistant 功能

控制台中的 AI 助手负责：

1. 接收自然语言请求
2. 解释当前系统对象
3. 生成 workflow / agent 草稿
4. 输出结构化宿主动作建议

## 5. 控制台命令模型

第一阶段正式命令固定为：

1. `/help`
2. `/workflows`
3. `/agents`
4. `/skills`
5. `/tools`
6. `/resources`
7. `/runs`
8. `/create-workflow`
9. `/create-agent`

命令模型要求：

1. 以 `/` 开头的输入由 shell 直接解析。
2. 普通自然语言输入默认交给 `studio-console` agent。
3. 执行动作和写入动作由 shell 统一确认和接线。

## 6. 架构分层

### 6.1 Studio CLI Layer

职责：

1. 提供 `pi-studio` 命令入口
2. 处理 help 与 `--console` 分流
3. 装配控制台运行上下文

### 6.2 Studio Console Shell

职责：

1. slash command 路由
2. 视图与状态管理
3. catalog 展示
4. 动作确认
5. 与 workflow / agent 执行链路接线

### 6.3 Studio Catalog Services

建议抽象：

1. `WorkflowCatalogService`
2. `AgentCatalogService`
3. `SkillCatalogService`
4. `ToolCatalogService`
5. `ResourceCatalogService`
6. `RunCatalogService`

职责：

1. 统一加载真实数据源
2. 屏蔽底层 registry / loader / store 差异
3. 输出结构化列表与详情

### 6.4 Studio Authoring Services

建议抽象：

1. `WorkflowAuthoringService`
2. `AgentAuthoringService`

职责：

1. 调用 draft generator / template registry / validator
2. 生成草稿
3. 输出预览
4. 进行保存前校验

### 6.5 Studio Assistant Runtime

职责：

1. 装配并运行 `studio-console` agent
2. 将自然语言请求转换为草稿建议或结构化宿主动作建议
3. 与 shell 的确认机制配合完成落地

## 7. 复用关系

### 7.1 Agent 相关复用

复用模块：

1. `packages/pi-workflow/src/agents/registry.ts`
2. `packages/pi-workflow/src/agents/resolver.ts`
3. `packages/pi-workflow/src/agents/invoker.ts`

用途：

1. `/agents` 列表与详情
2. `studio-console` agent 自身装配
3. 控制台中的 agent 运行入口

### 7.2 Workflow 相关复用

复用模块：

1. runtime context 工厂
2. workflow runner
3. inspect / trace / resume 链路
4. authoring draft / template / dry-run

用途：

1. `/workflows`
2. `/create-workflow`
3. workflow 运行与调试入口

### 7.3 Skill / Tool / Resource 复用

复用模块：

1. `skill-loader.ts`
2. `package-resource-loader.ts`
3. `extension-catalog.ts`
4. 宿主 `callTool()` 注册与 tool bridge

用途：

1. `/skills`
2. `/tools`
3. `/resources`
4. `studio-console` 的内部能力装配

## 8. 内置 agent 与资源布局

建议新增控制台内置资源目录，例如：

```text
apps/pi-studio-cli/
  src/
    builtin/
      agents/
        studio-console.toml
```

该目录承载：

1. `studio-console` agent 文件
2. 默认 prompt
3. 默认 skill / tool 暴露配置
4. 控制台内置元数据

## 9. CLI 与目录落点

### 9.1 CLI 工程落点

建议将 `pi-studio` 作为独立 app 落在：

```text
apps/
  pi-studio-cli/
```

理由：

1. 与 `apps/pi-workflow-cli` 保持并列关系，语义清晰。
2. `pi-studio` 是产品级入口，不应继续附着在 `pi-workflow-cli` 内部命名空间下。
3. 后续控制台、catalog、内置资源和独立 help 文案都需要自己的工程边界。

### 9.2 目录结构

建议目录结构如下：

```text
apps/
  pi-studio-cli/
    package.json
    tsconfig.json
    src/
      cli.ts
      console/
        studio-console-shell.ts
        studio-command-router.ts
        studio-state.ts
        studio-renderer.ts
      services/
        workflow-catalog-service.ts
        agent-catalog-service.ts
        skill-catalog-service.ts
        tool-catalog-service.ts
        resource-catalog-service.ts
        run-catalog-service.ts
        workflow-authoring-service.ts
        agent-authoring-service.ts
      builtin/
        agents/
          studio-console.toml
```

### 9.3 与现有 CLI 的关系

现有 CLI 保持如下落点：

```text
apps/
  pi-workflow-cli/
    src/
      cli.ts
      pi-agent-cli.ts
```

职责边界：

1. `pi-studio-cli`
   - 提供产品级宿主入口
   - 提供控制台
2. `pi-workflow-cli`
   - 提供 workflow 命令
   - 提供独立 `pi-agent` 命令入口实现

### 9.4 后续收口方向

后续可以按以下方式保持一致性：

1. `pi-studio` 只负责产品入口和控制台
2. `pi-workflow` 只负责 workflow 专项命令
3. `pi-agent` 只负责独立 agent 专项命令
4. 三组命令共享底层 runtime、authoring、resource 与 agent 装配能力

## 10. 与 Web Editor 的关系

`pi-studio` 控制台与 `pi-workflow-web` 形成互补关系：

1. 控制台负责：
   - catalog 浏览
   - AI 草稿生成
   - 运行与诊断
   - 向导式创建
2. Web editor 负责：
   - 可视化节点编辑
   - 复杂 DAG 布局与属性编辑

## 11. 演进目标

`pi-studio` 第一阶段形成宿主级控制台主链路，后续可继续演进：

1. workflow 总览 TUI 深化接入
2. agent 子视图与嵌入式 session 复用
3. 控制台内打开 Web editor 或导出到 Web 编辑链路
4. 更丰富的 catalog 操作与运行审计视图

## 12. 设计结论

本设计定义的 `pi-studio` 是一个新的宿主级产品入口，其核心价值在于：

1. 用统一控制台承载 workflow、agent、skill、tool、resource 的浏览与操作
2. 用 `studio-console` 特殊 agent 承载 AI 辅助创作与解释能力
3. 复用现有 `pi-workflow`、`pi-agent`、authoring、runtime、resource 主链路，而不是形成第二套系统
4. 保持现有外部命令继续可用，同时提供更高层的产品化入口

## 13. 相关计划

- [PLAN_PHASE-15_PI-STUDIO-CONSOLE.md](../PLANS/pi-workflow-phases/PLAN_PHASE-15_PI-STUDIO-CONSOLE.md)
