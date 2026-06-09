---
**版本锚点**
- 创建时间：2026-05-30 14:30 +08:00
- 最后更新：2026-05-30 16:31 +08:00
- 阶段状态：开发中
- 代码快照日期：2026-05-30

---

# 阶段 14：Web 工作流节点编辑器

> 借鉴 flow-eda 等业界节点编排器的成熟模式，为 pi-workflow 构建一个基于 Web 的可视化工作流编辑器，补齐 Phase 8 明确排除的 Web Viewer 能力。

## 1. 最终实现目标

阶段 14 完成后，用户应能通过浏览器完成工作流的可视化创建、编辑、验证与导出。

目标能力：

1. **画布渲染**：将 `WorkflowDslDocument` 渲染为可视化 DAG，支持缩放、平移、节点拖放。
2. **节点面板**：左侧展示全部 10 种节点类型，拖入画布即可创建节点。
3. **连线编辑**：鼠标拖拽建立 `dependsOn` 依赖边，composite 节点自动展示 `children` 父子边。
4. **属性编辑**：右侧面板按节点类型动态渲染表单（输入绑定、输出、控制流、capabilities）。
5. **序列化桥**：画布 ↔ `WorkflowDslDocument` JSON 双向无损转换。
6. **实时验证**：复用 `pi-workflow` 的 DSL validator，在编辑器中实时标红错误节点与边。
7. **导入/导出**：支持打开已有 `.workflow.json` 文件、通过浏览器下载导出当前画布为 DSL JSON。
8. **嵌入独立运行**：Vite 构建的纯前端 SPA，不依赖后端服务。

本阶段不要求：

1. 在 Web 中直接执行 workflow（运行仍需 CLI）。
2. 实时协作编辑。
3. 历史撤销/重做栈（可按后续需求迭代）。
4. 与 PI 宿主深度集成（如直接调用 agent）。

## 2. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | React 19 + TypeScript | 生态最大，类型安全 |
| 画布 | **@xyflow/react** (ReactFlow v12) | 社区最活跃的节点编辑器库，支持自定义节点/边/分组 |
| 构建 | Vite 6 | 快速 HMR，与 monorepo 其他包一致 |
| DSL 桥 | 复用 `@pi-workflow/core` 类型 | 直接引入 `WorkflowDslDocument`、`WorkflowNodeKind` 等类型 |
| 状态管理 | React useState + useReducer | 编辑器状态复杂度可控，无需引入 Redux/Zustand |
| 样式 | CSS Modules + CSS 变量 | 轻量，不引入 UI 库避免风格绑定 |

## 3. 架构设计

### 3.1 整体分层

```
┌──────────────────────────────────────────────┐
│  App.tsx (顶层布局：Toolbar + 三栏)            │
├──────────┬──────────────────┬────────────────┤
│NodePalette│    Canvas       │ PropertyPanel  │
│(左侧面板) │  (ReactFlow)    │  (右侧面板)     │
│          │                 │                │
│ 可拖放   │  自定义节点渲染  │  动态表单:      │
│ 节点列表  │  自定义连线样式  │  - 输入绑定    │
│          │  节点选中/高亮   │  - 输出配置    │
│          │                 │  - control     │
│          │                 │  - capabilities│
├──────────┴──────────────────┴────────────────┤
│           dsl-bridge.ts (双向转换)             │
│   GraphModel ⟷ WorkflowDslDocument           │
├──────────────────────────────────────────────┤
│         @pi-workflow/core 类型 + validator    │
└──────────────────────────────────────────────┘
```

### 3.2 数据模型

```typescript
// 可视化图模型 — 画布内部表示
interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryNodeId: string | null;
  meta: { id: string; version: string; title: string };
}

interface GraphNode {
  id: string;
  type: WorkflowNodeKind;        // 10 种节点类型
  position: { x: number; y: number };
  data: {
    title: string;
    inputs: Record<string, ValueRef>;
    output?: WorkflowDslOutputBinding;
    children?: string[];
    control?: WorkflowDslControlConfig;
    capabilities?: WorkflowDslAgentConfig;
    executor?: WorkflowDslExecutorConfig;
    missingInput?: WorkflowDslMissingInput;
    errors: string[];             // 验证错误，实时标红
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "dependency" | "parent-child";
}
```

### 3.3 节点类型注册表

每种节点类型的可视化元信息：

```typescript
interface NodeTypeMeta {
  kind: WorkflowNodeKind;
  label: string;          // 中文名称
  color: string;          // 节点背景色
  icon: string;           // 图标（emoji 或 SVG 路径）
  category: "primitive" | "composite";
  defaultInputs: Record<string, ValueRef>;
  hasChildren: boolean;
  hasCondition: boolean;
  hasLoopConfig: boolean;
  hasCapabilities: boolean;
}
```

| kind | label | color | category | 特殊配置 |
|------|-------|-------|----------|---------|
| `manual` | 手动 | #6B7280 | primitive | missingInput |
| `return` | 返回 | #10B981 | primitive | output |
| `agent` | 智能体 | #8B5CF6 | primitive | capabilities(skills/tools/mcp) |
| `tool` | 工具 | #F59E0B | primitive | toolName + params |
| `http` | HTTP | #3B82F6 | primitive | url/method/headers |
| `extractor` | 提取器 | #EC4899 | primitive | sourceType/mode/fields |
| `if` | 条件 | #EF4444 | composite | condition + children |
| `parallel` | 并行 | #06B6D4 | composite | children |
| `loop` | 循环 | #14B8A6 | composite | loopOver + itemName + children |
| `workflow` | 子工作流 | #6366F1 | composite | children |

### 3.4 DSL 桥接转换

```
loadFromJson(json)                    exportToJson()
  │                                       ▲
  ▼                                       │
WorkflowDslDocument                 WorkflowDslDocument
  │                                       ▲
  │  dslToGraphModel()                    │  graphToDsl()
  ▼                                       │
GraphModel ──────────────────────▶ GraphModel
           (用户在画布上编辑)
```

**关键映射规则**：

1. **nodes**：`dsl.nodes[].id` → `GraphNode.id`，`executor.type` → `GraphNode.type`
2. **edges**：`dsl.nodes[].dependsOn` → `GraphEdge(type: "dependency")`；复合节点 `children` → `GraphEdge(type: "parent-child")`
3. **entry**：`dsl.entry` → `GraphModel.entryNodeId`
4. **position**：自动布局或从已有 `data.position` 恢复
5. **inputs**：`ValueRef` 直接透传，编辑器中提供下拉选择引用源

### 3.5 自定义节点渲染

每个节点在画布上渲染为圆角卡片：

```
┌──────────────────────┐
│ 🔵 节点标题           │  ← header (colored by type)
├──────────────────────┤
│ 输入: ...            │  ← 简略输入预览
│ 输出 → result        │  ← 输出目标路径
│ [子节点: 3个]        │  ← composite 特有
├──────────────────────┤
│ ● input  ○ output    │  ← ReactFlow handles
└──────────────────────┘
```

## 4. 目录设计

```text
apps/pi-workflow-web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx                    # React 入口
    App.tsx                     # 顶层布局
    App.css                     # 全局样式
    types/
      graph.ts                  # GraphModel / GraphNode / GraphEdge 类型
      registry.ts               # NodeTypeMeta 注册表
      dsl-bridge.ts             # DSL ↔ GraphModel 双向转换
    components/
      Toolbar.tsx               # 顶部工具栏
      Canvas.tsx                # ReactFlow 画布封装
      NodePalette.tsx           # 左侧可拖放节点面板
      PropertyPanel.tsx         # 右侧属性编辑面板
      nodes/
        BaseNode.tsx            # 自定义节点渲染（ReactFlow custom node）
        node-registry.ts        # 10 种节点类型的 ReactFlow nodeTypes 映射
      properties/
        InputBindingEditor.tsx  # ValueRef 编辑器（from/path 选择）
        OutputConfigEditor.tsx  # 输出绑定编辑器
        ControlEditor.tsx       # if/loop/parallel 控制配置
        CapabilitiesEditor.tsx  # agent skills/tools/mcp 编辑
        ExecutorConfigEditor.tsx # extractor 配置编辑
    hooks/
      useWorkflow.ts            # 工作流状态管理（加载/编辑/导出/验证）
    utils/
      layout.ts                 # 自动布局算法（dagre 等）
      validator.ts              # 复用 @pi-workflow/core validator
```

## 5. 核心实现路径

### 5.1 项目初始化

```bash
# 在 monorepo 根目录执行
pnpm install  # 安装 @xyflow/react 等新依赖
```

### 5.2 分步实现

| 步骤 | 内容 | 验收标准 |
|------|------|---------|
| 1 | 搭建 Vite + React + ReactFlow 骨架 | `npm run dev` 显示空白画布 |
| 2 | 实现 `GraphModel` 类型 + `dsl-bridge.ts` | `all-node-types.workflow.json` 可转为 GraphModel 并渲染 |
| 3 | 实现 `BaseNode.tsx` 自定义节点渲染（10 种） | 每种节点正确显示颜色/图标/简略信息 |
| 4 | 实现 `NodePalette.tsx` 拖放创建节点 | 从面板拖入画布生成新节点 |
| 5 | 实现连线编辑 + dependsOn 边 | 拖拽 handle 建立/删除边 |
| 6 | 实现 `PropertyPanel.tsx` 属性编辑 | 选中节点后右侧显示对应配置表单 |
| 7 | 实现 `InputBindingEditor.tsx` ValueRef 编辑 | 下拉选择 literal/node.output/run.input/frame.local |
| 8 | 实现 `ControlEditor.tsx` / `CapabilitiesEditor.tsx` | if/loop/agent 节点配置完整可编辑 |
| 9 | 实现导出 → `WorkflowDslDocument` JSON | 导出的 JSON 可被 CLI `pi-workflow run` 正确加载 |
| 10 | 实现加载已有 `.workflow.json` 文件 | 加载后画布正确渲染节点与边 |
| 11 | 接入 validator 实时校验 | 错误节点红色边框 + 错误信息提示 |
| 12 | 工具栏：新建/加载/导出下载/自动布局 | 完整编辑工作流 |

## 6. 关键设计决策

### 6.1 Composite 节点的可视化

`if`/`parallel`/`loop`/`workflow` 四种复合节点在画布上的表现：

- **外层**：复合节点本身作为普通节点渲染，颜色与基元节点区分
- **children 关系**：用虚线 `parent-child` 边连接复合节点到其子节点
- **dependsOn 关系**：实线 `dependency` 边表示执行顺序依赖
- **子节点**仍然可以是任意类型，包括嵌套 composite

### 6.2 ValueRef 编辑器

这是最核心的交互组件。每种 ValueRef 类型需要不同的 UI：

| from 类型 | UI 交互 |
|-----------|---------|
| `literal` | 文本框输入 value |
| `run.input` | 输入 path 路径 |
| `node.output` | 下拉选择节点 ID + 输入 path |
| `context` | 输入 path 路径 |
| `frame.local` | 输入 path 路径（仅 loop 内可用） |

### 6.3 自动布局

初始加载或"整理布局"按钮触发，使用 dagre 算法：

- 按拓扑排序分层
- 每层水平排列
- 复合节点的 children 在父节点下方

## 7. 测试与验收

验收标准：

1. 从画布创建包含全部 10 种节点类型的工作流，导出 JSON 可被 CLI 正确加载执行。
2. 加载 `all-node-types.workflow.json` 后画布正确渲染所有 13 个节点和边。
3. 修改节点属性后导出 JSON 可反映变更。
4. 验证器可标红缺少必填字段的节点。
5. 从面板拖入节点后自动生成唯一 ID。
6. 删除节点时同步删除相关边。

## 8. 风险与依赖

- **风险 1**：ReactFlow v12 的 API 仍在快速迭代，需锁定版本。当前 `12.6.x`。
- **风险 2**：`@xyflow/react` 的 TypeScript 类型可能不够精确，需要 `skipLibCheck`。
- **风险 3**：自动布局算法在复合节点嵌套场景下可能不够理想，需迭代调整。
- **风险 4**：ValueRef 编辑器交互复杂，需充分测试各种引用组合。

依赖：

1. 阶段 1 DSL 类型与 validator 稳定。
2. 阶段 5 通用节点类型定义完成。
3. 阶段 8 graph-model.ts 已有 graph view model。

## 9. 完成定义（DoD）

- [x] 10 种节点类型均可在画布上创建、编辑、连线、删除。
- [x] 支持加载/导出下载 `WorkflowDslDocument` JSON 文件；“保存”当前定义为浏览器下载，不依赖后端。
- [x] 属性面板支持 ValueRef、output、control、capabilities 完整编辑。
- [x] 验证器实时反馈节点错误。
- [x] 自动布局可整理画布。
- [x] `npm run dev` 可独立运行，无后端依赖。
- [ ] 阶段计划、索引同步更新。

## 10. 参考项目

| 项目 | 借鉴点 |
|------|--------|
| [flow-eda](https://github.com/Linxfeng/flow-eda) | 节点编辑器整体架构、节点面板 + 属性面板布局 |
| [ReactFlow Examples](https://reactflow.dev/examples) | 自定义节点、拖放创建、边类型、分组嵌套 |
| [Node-RED](https://nodered.org/) | 节点注册表、调色板分类、连线验证 |
| [n8n](https://n8n.io/) | 工作流编辑器 UX、节点参数表单设计 |
