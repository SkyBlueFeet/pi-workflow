# 阶段 15：pi-studio 宿主级控制台

> 创建时间：2026-06-12 22:10 +08:00
> 最后更新：2026-06-12 22:26 +08:00
> 当前状态：规划中
> 验收状态：未验收

---

## 1. 背景与目标

- 背景：
  当前仓库已有 `pi-workflow`、`pi-agent`、独立 `pi-tui` agent 运行面、workflow display shell、Web workflow editor，以及一批可复用的 authoring、resource、tool、registry 能力。下一步需要先把 `pi-studio` 控制台骨架搭起来，形成稳定的 CLI 工程边界、命令入口和模块划分。
- 目标：
  1. 将 CLI 工程收口为 `pi-studio-cli`，并在内部清晰划分 `pi-studio`、`pi-workflow`、`pi-agent` 三组命令入口所需模块。
  2. 固定 `pi-studio` 默认显示 help，`pi-studio --console` 进入控制台骨架。
  3. 先把控制台 shell、命令路由、catalog 服务、AI 助手接线的骨架建立起来。
  4. 通过打包/安装流程生成 `studio-console` 内置 agent 资源，并放到全局位置供控制台加载。
  5. 先接通 `/workflows`、`/agents`、`/create-workflow`、`/create-agent` 这些控制台命令入口，具体执行语义后续再继续收口。
- 范围：
  1. `pi-studio-cli` 工程与命令入口
  2. 控制台 shell 骨架
  3. slash command 骨架
  4. catalog 服务骨架
  5. `studio-console` 全局内置资源生成链路
  6. `/workflows`、`/agents`、`/create-workflow`、`/create-agent` 命令接线骨架

---

## 2. 交付范围

- [ ] 交付 `pi-studio-cli` CLI 工程骨架
- [ ] 交付 `pi-studio` help 与 `--console` 控制台入口
- [ ] 交付三组对外命令的内部模块边界：`pi-studio`、`pi-workflow`、`pi-agent`
- [ ] 交付控制台命令骨架：`/workflows`、`/agents`、`/create-workflow`、`/create-agent`
- [ ] 交付 catalog 服务骨架
- [ ] 交付 `studio-console` 全局内置资源生成与加载骨架
- [ ] 交付控制台 AI 助手接线骨架
- [ ] 交付阶段文档、索引与验收证据同步

---

## 3. 分阶段任务

### Phase 1：建立产品入口

- [ ] 将现有 CLI 工程收口为 `pi-studio-cli`
- [ ] 固化 `pi-studio`、`pi-workflow`、`pi-agent` 三组对外命令的入口关系
- [ ] 输出 `pi-studio` help 信息
- [ ] 接通 `pi-studio --console`
- [ ] 划分 `pi-studio-cli` 内部模块边界
- [ ] 验证 `pi-workflow`、`pi-agent` 外部命令仍保持现有行为

### Phase 2：建立控制台 shell

- [ ] 新增控制台 shell 主循环
- [ ] 新增控制台状态模型
- [ ] 新增输入分流与 slash command 解析器
- [ ] 实现 `/help`
- [ ] 接通 `/workflows`
- [ ] 接通 `/agents`
- [ ] 接通 `/create-workflow`
- [ ] 接通 `/create-agent`

### Phase 3：建立 catalog 服务

- [ ] 实现 `WorkflowCatalogService`
- [ ] 实现 `AgentCatalogService`
- [ ] 接通 `/workflows`
- [ ] 接通 `/agents`

### Phase 4：接入 `studio-console` 特殊 agent

- [ ] 建立 `studio-console` 内置资源模板
- [ ] 接通打包/安装时的全局资源生成流程
- [ ] 接通控制台 AI 助手运行时骨架
- [ ] 建立自然语言输入到 AI 助手的接线

### Phase 5：接入创作主链路

- [ ] 接通 `/create-workflow` 命令骨架
- [ ] 接通 `/create-agent` 命令骨架
- [ ] 预留 workflow authoring service 接口
- [ ] 预留 agent authoring service 接口
- [ ] 建立创作链路的模块边界

### Phase 6：接入执行与诊断

- [ ] 接通控制台命令到宿主动作层的调用骨架
- [ ] 预留 workflow 执行入口接线点
- [ ] 预留 agent 执行入口接线点
- [ ] 建立执行结果展示骨架

### Phase 7：测试与收尾

- [ ] 补 `pi-studio` CLI 入口测试
- [ ] 补控制台 slash command 路由测试
- [ ] 补 catalog 服务测试
- [ ] 补 `studio-console` 助手接线测试
- [ ] 补 `/workflows`、`/agents`、`/create-workflow`、`/create-agent` 命令骨架测试
- [ ] 补 `pi-workflow`、`pi-agent` 外部命令兼容测试
- [ ] 同步设计文档、阶段索引、总计划和必要开发留痕

---

## 4. 目录设计

目录落点如下：

```text
apps/
  pi-studio-cli/
    src/
      cli.ts
      commands/
        studio.ts
        workflow.ts
        agent.ts
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
      packaging/
        install-studio-resources.ts
```

可复用模块保持在原有位置：

1. `packages/pi-workflow/src/agents/`
2. `packages/pi-workflow/src/authoring/`
3. `packages/pi-workflow/src/adapters/pi/`
4. `apps/pi-workflow-cli/src/runtime/`
5. `apps/pi-workflow-cli/src/workflow-runner/`
6. `apps/pi-workflow-cli/src/display/`

CLI 职责分布固定为：

1. `pi-studio-cli`
   - 承载 `pi-studio`、`pi-workflow`、`pi-agent` 的工程实现
   - 在内部划分 studio / workflow / agent 三组模块
2. `pi-studio`
   - 产品入口与控制台
3. `pi-workflow`
   - workflow 专项命令
4. `pi-agent`
   - agent 专项命令

---

## 5. 风险与依赖

- 风险：
  1. 控制台 shell、AI 助手和既有 CLI 运行面若不分层，后续会出现语义混杂。
  2. catalog 若不经过服务层收口，后续会在多个视图里重复拼接底层 loader 与 registry。
  3. 全局内置资源生成链路若未先固定，后续 `studio-console` 的加载方式会持续摇摆。
- 依赖：
  1. 依赖阶段 10 的独立 agent 主链路。
  2. 依赖阶段 10.5 的 shell / display / 统一装配成果。
  3. 依赖阶段 7 的 authoring 能力。
  4. 依赖阶段 9 的资源加载能力。
  5. 依赖阶段 13 的宿主工具与 `callTool()` 能力。
  6. 依赖 [DESIGN_PI-STUDIO-CONSOLE.md](../../DESIGN/DESIGN_PI-STUDIO-CONSOLE.md) 作为设计依据。

---

## 6. 完成定义（DoD）

- [ ] `pi-studio-cli` 工程已形成正式骨架
- [ ] `pi-studio` help 与 `--console` 已可用
- [ ] `pi-studio`、`pi-workflow`、`pi-agent` 三组命令已在同一工程中完成模块划分
- [ ] 控制台 shell、catalog 服务和 `studio-console` AI 助手已完成骨架接线
- [ ] `/workflows`、`/agents`、`/create-workflow`、`/create-agent` 四个命令已完成骨架接线
- [ ] `studio-console` 全局内置资源生成链路已形成
- [ ] `pi-workflow` 与 `pi-agent` 外部命令保持可用
- [ ] 相关质量检查已完成
- [ ] 必要文档与索引已同步
- [ ] 已具备验收条件

---

## 7. 验收结论

- 验收时间：
- 技术栈：
- 目标完成情况：
  - [ ] 目标 1：`pi-studio-cli` 工程与命令入口骨架完成
  - [ ] 目标 2：控制台 shell 与四个核心命令骨架完成
  - [ ] 目标 3：catalog 服务与 `studio-console` 资源生成骨架完成
  - [ ] 目标 4：`pi-workflow` / `pi-agent` 外部命令兼容完成
- 非功能检查：
- 最终判定：未验收
- 遗留事项：
