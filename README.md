# Pi Workflow

Pi Workflow 是一个面向 Agent 和工具编排场景的工作流运行时。它可以加载 workflow 定义、生成执行计划、驱动节点运行、输出运行事件，并支持暂停与恢复。

## Status

- Status: `Experimental`
- License: [MIT](./LICENSE)
- Node.js: `>=22`
- Repository: <https://github.com/SkyBlueFeet/pi-workflow>


当前暂未发布 npm 包，现阶段主要以源码仓库方式协作与使用，后续计划按包逐步开放 npm 发布。

## Features

- Workflow DSL 加载、校验与 IR 映射
- 确定性 runtime 调度与节点执行
- Pause / resume 与 checkpoint 状态恢复
- 子工作流递归展开与显式 frame 栈管理
- `manual`、`return`、`workflow`、`agent` 节点支持
- `tool`、`http`、`if`、`parallel`、`loop` 通用编排节点支持
- 调试、trace、inspect 与事件输出能力
- 面向 PI 宿主能力的 adapter、package 与 extension 接入

## Use Cases

- 基于 DSL 的工作流编排与执行
- Agent、工具调用与子工作流混合编排
- 需要暂停、恢复和可追踪运行状态的任务流
- 面向 PI 宿主环境的扩展型工作流系统

## Project Structure

```text
packages/
  pi-workflow/           Core runtime, DSL, IR, executors, store, adapters
  pi-package-adapter/    PI package adapter bindings
  pi-extension-loader/   Extension loading utilities
  pi-builtin-tools/      Built-in tools and extension entrypoints
apps/
  pi-workflow-cli/       CLI for build, run, resume, trace, inspect, policy
```

## Installation

当前以源码方式使用：

```bash
git clone https://github.com/SkyBlueFeet/pi-workflow.git
cd pi-workflow
npm install
```

## Quick Start

构建项目：

```bash
npm run build
```

运行测试：

```bash
npm test
```

查看 CLI 帮助：

```bash
node apps/pi-workflow-cli/dist/cli.js --help
```

## CLI

构建 workflow bundle：

```bash
node apps/pi-workflow-cli/dist/cli.js build <workflow-dir>
```

运行目录式 workflow：

```bash
node apps/pi-workflow-cli/dist/cli.js run --dir <workflow-dir> [input.json] [--mock]
```

运行 `.pwb` bundle：

```bash
node apps/pi-workflow-cli/dist/cli.js run <workflow.pwb> [input.json] [--mock]
```

恢复暂停的 workflow：

```bash
node apps/pi-workflow-cli/dist/cli.js resume <workflowRunId> [input.json]
```

输出完整 trace：

```bash
node apps/pi-workflow-cli/dist/cli.js trace <workflow-path> [input.json]
```

检查 workflow 结构：

```bash
node apps/pi-workflow-cli/dist/cli.js inspect <workflow-path> [options]
```

更多命令：

- `build`
- `run`
- `resume`
- `trace`
- `inspect`
- `pkg`
- `agent`
- `policy`

## Workflow Format

当前正式导入入口为目录式 DSL：

```text
my-workflow/
  flow.json
  nodes/
  prompts/
  stages/
```

说明：

1. `flow.json` 可选声明 `$schema`
2. 当前 loader 仅接受 `urn:pi-workflow:dsl:v1`
3. `entry` 缺失时，仅在存在唯一无入边节点时自动推导
4. 多候选入口会返回结构化错误，而不是猜测默认入口

## Example

仓库包含示例文件：

- `packages/pi-workflow/examples/agent-summarize.workflow.json`
- `packages/pi-workflow/examples/summarize-input.json`

在完成构建后，可参考如下方式运行：

```bash
node apps/pi-workflow-cli/dist/cli.js run --json packages/pi-workflow/examples/agent-summarize.workflow.json packages/pi-workflow/examples/summarize-input.json --mock
```

## Architecture

```text
Authoring Layer     -> workflow definition authoring and revision
DSL Layer           -> schema, loader, validator, mapper
Workflow IR         -> host-agnostic workflow graph model
Workflow Runtime    -> planner, scheduler, frames, events, persistence
PI Host Adapter     -> bridge to PI Agent, Tool, Resource capabilities
```

详细架构见 [`developers/pi-workflow-architecture.md`](developers/pi-workflow-architecture.md)。

## Development

常用命令：

```bash
npm run build
npm test
npm run lint
```

设计原则：

- 垂直切片交付，而不是一次性铺满全部架构
- DSL / IR / Runtime / Adapter 边界分离
- 所有数据引用统一为 `ValueRef`
- 用户定义问题优先返回结构化 diagnostic

## Roadmap

- 稳定 DSL 与公开 API
- 完善真实 PI 权限与信任源对接
- 增强调试与可视化体验
- 后续逐步开放 npm 发布


## Security

安全问题请参见 [SECURITY.md](./SECURITY.md)。

## License

本项目基于 [MIT License](./LICENSE) 开源。
