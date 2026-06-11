# LangGraph / LangChain 设计借鉴分析

> 分析 pi-workflow 与 LangGraph/LangChain 的设计差异，提取可借鉴的设计思路与具体实现建议。

## 文档版本

| 字段 | 值 |
|---|---|
| 创建时间 | 2026-06-10 |
| 最后更新 | 2026-06-10 |
| 代码快照 | `@pi-workflow/core@1.0.0` |
| 分析依据 | packages/pi-workflow/src 全量阅读 |

## 参考代码

| 文件 | 作用 |
|---|---|
| `src/ir/types.ts` | IR 类型定义（核心数据模型） |
| `src/dsl/types.ts` | DSL 类型定义（面向用户的配置格式） |
| `src/runtime/runtime-executor.ts` | 运行时执行入口 |
| `src/runtime/runtime-node-executor.ts` | 节点执行器（权限、超时、重试、流式） |
| `src/runtime/runtime-composite-executor.ts` | 复合节点执行器（if/parallel/loop/workflow） |
| `src/runtime/scheduler.ts` | 调度器（依赖驱动的 DAG 执行） |
| `src/runtime/planner.ts` | 规划器（就绪节点计算） |
| `src/runtime/frame-manager.ts` | 帧管理器 |
| `src/runtime/workflow-runtime.ts` | 运行时入口（run/resume/runSubWorkflow） |
| `src/executors/agent-executor.ts` | Agent 节点执行器 |
| `src/events/types.ts` | 事件类型定义 |
| `src/store/types.ts` | 存储类型定义 |
| `src/host/types.ts` | 宿主契约 |

---

## 一、整体架构对比

```
┌─────────────────────────────────────────────────────────┐
│                    pi-workflow                           │
│                                                         │
│  DSL (.json/.toml)                                      │
│    │  loader + mapper + validator + normalizer          │
│    ▼                                                    │
│  IR (标准化中间表示)                                      │
│    │  scheduler + value resolver + node executor        │
│    ▼                                                    │
│  Runtime (AsyncGenerator 事件流)                         │
│    │  host.emitEvent() → 宿主环境 (TUI/CLI/Web)         │
│    ▼                                                    │
│  输出 (sharedContext)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   LangGraph                             │
│                                                         │
│  Python Code (编程式构建图)                               │
│    │  add_node / add_edge / add_conditional_edges       │
│    ▼                                                    │
│  StateGraph (状态机图)                                   │
│    │  State: TypedDict (集中式状态)                      │
│    │  Node: State → State 的函数                        │
│    │  Edge: 条件路由 / 固定路由                          │
│    ▼                                                    │
│  Runtime (可暂停/恢复的图执行)                            │
│    │  StreamEvent (细粒度事件流)                         │
│    ▼                                                    │
│  输出 (State 最终快照)                                    │
└─────────────────────────────────────────────────────────┘
```

### 核心哲学差异

| 维度 | pi-workflow | LangGraph |
|------|-------------|-----------|
| **配置方式** | 声明式（JSON/TOML） | 编程式（Python 代码） |
| **目标用户** | 非开发者/低代码场景 | Python 开发者 |
| **状态模型** | 隐式 `sharedContext: Record<string, unknown>` | 显式 `TypedDict` 状态 |
| **图模型** | DAG（有向无环图 + 复合节点内子图） | 有环图（状态机，支持循环） |
| **数据流** | ValueRef 按路径引用 | State 直接读写 |
| **事件模型** | AsyncGenerator 事件流 | StreamEvent + callbacks |
| **宿主关系** | 宿主无关（emitEvent 契约） | Python 运行时绑定 |

---

## 二、可借鉴的设计点

### 2.1 显式状态管理（最高优先级）

#### 现状

pi-workflow 的 `sharedContext: Record<string, unknown>` 是一个无结构的键值对容器：

```typescript
// 当前：隐式、无类型、无作用域隔离
const sharedContext: Record<string, unknown> = {};
// 任何节点可以读写任何路径
sharedContext["summary"] = "xxx";
sharedContext["messages"] = [...];
```

问题：
- 类型不安全，运行时才能发现字段名拼写错误
- 没有消息历史的结构化表达（Agent 对话历史在 PI host 黑盒内部）
- Debug 时只能 dump 整个对象，无法增量追踪
- 并行分支间没有状态隔离

#### LangGraph 的做法

```python
# LangGraph: 显式 TypedDict 状态
class AgentState(TypedDict):
    messages: list          # 对话历史，每个节点可追加
    next_step: str          # 路由指示
    intermediate_steps: list  # 中间结果

# reducer 控制如何合并状态
def add_messages(left, right):
    return left + right  # 追加模式

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 带合并策略
```

#### 借鉴建议

在 pi-workflow 中引入可选的**显式 State 声明**：

```typescript
// 方案 A：在 DSL 中声明工作流状态结构
{
  "id": "chat-workflow",
  "state": {                          // 新增：状态声明
    "messages": {
      "type": "array",
      "mergeStrategy": "append",      // 合并策略（类似 LangGraph reducer）
      "description": "对话历史"
    },
    "summary": {
      "type": "string",
      "mergeStrategy": "replace",
      "description": "最终摘要"
    },
    "counters": {
      "type": "object",
      "mergeStrategy": "merge-object",
      "description": "计数器"
    }
  },
  "nodes": [ ... ]
}
```

```typescript
// 方案 B：在 IR 层增加 StateSchema
interface WorkflowStateSchema {
  readonly fields: Record<string, {
    readonly type: "string" | "number" | "boolean" | "array" | "object";
    readonly mergeStrategy?: "replace" | "merge-object" | "append-array" | "append";
    readonly description?: string;
  }>;
}

// WorkflowDefinitionIR 增加 stateSchema 字段
interface WorkflowDefinitionIR {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly entryNodeIds: readonly string[];
  readonly nodes: readonly WorkflowNodeIR[];
  readonly edges: readonly WorkflowEdgeIR[];
  readonly finalOutput?: WorkflowOutputBindingIR;
  readonly stateSchema?: WorkflowStateSchema;  // 新增
}
```

```typescript
// 方案 C：运行时支持 State 快照（类似 LangGraph 的 getState）
interface StateSnapshot {
  readonly values: Record<string, unknown>;        // 当前状态值
  readonly config?: {                              // 运行时配置
    readonly runId: string;
    readonly threadId: string;
  };
  readonly metadata: {
    readonly startedAt: string;
    readonly stepCount: number;
    readonly currentNode?: string;
    readonly completedNodes: readonly string[];
    readonly pendingNodes: readonly string[];
  };
}

// WorkflowRuntime 增加 getState 方法
class WorkflowRuntime {
  getState(runId: string): StateSnapshot | undefined;
  getStateHistory(runId: string): StateSnapshot[];  // 状态变更历史
}
```

#### 收益

- **可调试**：每次节点执行后记录 State 快照，支持时间旅行
- **可验证**：运行前校验 State 字段声明与节点实际读写一致
- **可恢复**：pause/resume 时 State 结构清晰，不依赖共享对象的隐式状态
- **可追踪**：每个字段的变更历史可追溯（谁在什么时候改了什么）

---

### 2.2 动态条件路由（高优先级）

#### 现状

pi-workflow 的节点间依赖是静态的 `dependsOn` 列表：

```typescript
// 当前：只能在 DSL 编译期确定依赖关系
{
  "id": "nodeB",
  "dependsOn": ["nodeA"]  // 固定边
}
```

条件分支只有 `if` 复合节点（二选一执行子节点），无法在节点执行**后**根据输出动态路由到不同的下游节点。

**缺失的场景**：
- Agent ReAct 循环（调工具 → 继续思考 / 直接回复 → 结束）
- 错误重定向（失败 → 走 fallback 分支）
- 多轮对话（用户输入 → Agent 回复 → 判断是否需要继续追问）
- 人工审核（通过 → 继续 / 驳回 → 修改 / 拒绝 → 终止）

#### LangGraph 的做法

```python
# LangGraph: 条件边根据 State 动态路由
def should_continue(state):
    messages = state["messages"]
    last_msg = messages[-1]
    if last_msg.tool_calls:
        return "tool_node"     # 继续调工具
    elif state.get("needs_fix"):
        return "fix_node"      # 走修复分支
    else:
        return "__end__"       # 结束

graph.add_conditional_edges(
    "agent_node",
    should_continue,
    {
        "tool_node": "tool_node",
        "fix_node": "fix_node",
        "__end__": END,
    }
)
```

#### 借鉴建议

在 IR 中增加条件边（Conditional Edge）概念，与现有的 `dependsOn` 共存：

```typescript
// 方案：在 IR 层增加条件边
interface WorkflowConditionalEdgeIR {
  readonly from: string;                      // 源节点
  readonly conditions: readonly {
    readonly expression: ValueRef;            // 条件表达式（已有 ValueRef 系统）
    readonly operator?: "equals" | "not-equals" | "exists" | "truthy" | "matches";
    readonly compareValue?: unknown;          // 比较值（用于 equals/not-equals/matches）
    readonly target: string;                  // 满足条件时路由到的目标节点
    readonly description?: string;            // 可读描述（用于可视化）
  }[];
  readonly defaultTarget?: string;            // 无一满足时的默认路由
}

// WorkflowDefinitionIR 增加 conditionalEdges
interface WorkflowDefinitionIR {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly entryNodeIds: readonly string[];
  readonly nodes: readonly WorkflowNodeIR[];
  readonly edges: readonly WorkflowEdgeIR[];          // 固定边（现有）
  readonly conditionalEdges?: readonly WorkflowConditionalEdgeIR[];  // 新增：条件边
  readonly finalOutput?: WorkflowOutputBindingIR;
}
```

DSL 层表达：

```json
{
  "id": "agent-decision",
  "executor": { "type": "agent" },
  "output": { "to": "agent_response" }
},
{
  "id": "tool-caller",
  "executor": { "type": "tool" },
  "dependsOn": ["agent-decision"]
},
{
  "id": "responder",
  "executor": { "type": "return" },
  "dependsOn": ["agent-decision"]
},
{
  "conditionalEdges": [
    {
      "from": "agent-decision",
      "conditions": [
        {
          "expression": { "from": "context", "path": "agent_response.action" },
          "operator": "equals",
          "compareValue": "call_tool",
          "target": "tool-caller",
          "description": "Agent 决定调工具"
        },
        {
          "expression": { "from": "context", "path": "agent_response.action" },
          "operator": "equals",
          "compareValue": "respond",
          "target": "responder",
          "description": "Agent 决定直接回复"
        }
      ],
      "defaultTarget": "responder"
    }
  ]
}
```

运行时改动：

```typescript
// Scheduler 增加条件边评估逻辑
class Scheduler {
  getReadyNodes(
    frameNodeIds: readonly string[],
    ir: WorkflowDefinitionIR,
    completedNodes: ReadonlySet<string>,
  ): readonly string[] {
    const ready: string[] = [];
    for (const nodeId of frameNodeIds) {
      if (completedNodes.has(nodeId)) continue;
      const node = ir.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      // 检查固定依赖
      const depsMet = node.dependsOn.every(dep => completedNodes.has(dep));
      if (!depsMet) continue;
      
      // 检查条件边路由（如果该节点只能通过条件边到达）
      const conditionalIncoming = ir.conditionalEdges?.filter(e => e.conditions.some(c => c.target === nodeId));
      if (conditionalIncoming && conditionalIncoming.length > 0) {
        // 只有条件边指向的节点才执行（由条件路由决定，不由 dependsOn 驱动）
        // 这部分逻辑移到条件边评估阶段
        ready.push(nodeId);
        continue;
      }
      
      ready.push(nodeId);
    }
    return ready;
  }
}
```

#### 收益

- **表达能力跃升**：从静态 DAG 升级为动态图，支持 ReAct 循环、错误恢复、多轮对话
- **向后兼容**：`dependsOn` 继续有效，条件边是增量能力
- **可视化友好**：条件边可以渲染为带标签的有向边，直观展示工作流逻辑

---

### 2.3 Agent 循环显式化（中优先级）

#### 现状

AgentExecutor 内部通过 PI host 的 `runAgent` 实现了 ReAct 循环，但对工作流引擎是黑盒：

```typescript
// AgentExecutor 内部：runAgent 封装了整个 ReAct 循环
const gen = piHost.runAgent({
  prompt: userPrompt,
  model,
  tools,
  // ...
});
// 工作流只看得到最终文本输出，看不到中间步骤
```

问题：
- 工作流无法在 Agent 每次工具调用后介入（如权限审批、暂停审核）
- 无法限制循环深度（runAgent 内部可能无限循环）
- 无法复用 Agent 的部分步骤（如只单独调工具，不用 LLM 思考）

#### LangGraph 的做法

LangGraph 把 ReAct 循环展开为图的显式节点：

```python
# LangGraph: ReAct 循环是图的一等公民
graph = StateGraph(AgentState)

graph.add_node("agent", call_model)       # LLM 思考
graph.add_node("tools", call_tool)        # 工具执行

graph.add_edge("agent", "tools")          # agent → tools
graph.add_conditional_edges(
    "tools",
    should_continue,                      # tool 完成后判断：继续还是结束
    {"agent": "agent", "__end__": END}
)
graph.set_entry_point("agent")
```

每一步都是图中的一个节点，可以：
- 在每一步之间插入权限检查
- 看到中间状态（思考了什么、调了什么工具、得到了什么结果）
- 限制最大迭代次数
- 支持人工介入（如审批工具调用）

#### 借鉴建议

方案 A：在 DSL 中提供 `agent-loop` 节点类型，展开循环：

```json
{
  "id": "coding-agent-loop",
  "executor": { "type": "agent-loop" },
  "capabilities": {
    "tools": [
      { "name": "read", "source": "builtin" },
      { "name": "edit", "source": "builtin" }
    ]
  },
  "control": {
    "loopOver": { "from": "context", "path": "messages" },
    "maxIterations": 25,
    "condition": { "from": "frame.local", "path": "shouldContinue" }
  },
  "output": {
    "to": "messages",
    "mergeStrategy": "append-array"
  }
}
```

运行时展开为：
```
agent-think → [tool-call → tool-result → agent-think] × N → final-answer
```

每步之间的事件：

```typescript
{ type: "node.progress", subType: "agent.thinking", delta: "我需要先读取文件..." }
{ type: "node.progress", subType: "agent.tool_call", toolName: "read", args: { path: "..." } }
{ type: "node.progress", subType: "agent.tool_result", toolName: "read", result: "..." }
// ...
```

方案 B：更轻量 —— 扩展现有 AgentExecutor，在工作流层面暴露迭代事件：

```typescript
// AgentExecutor 每次迭代都 emit 事件，而不是等 runAgent 全部完成
async *executeStreaming(node, context) {
  const maxIterations = node.control?.maxIterations ?? 25;
  for (let i = 0; i < maxIterations; i++) {
    yield { type: "agent.iteration_start", iteration: i };
    
    // Agent 思考
    const thought = yield* this.agentThink(...);
    yield { type: "agent.thought", content: thought };
    
    // 判断是否需要调工具
    if (needsTool(thought)) {
      // 每次工具调用前 emit 事件，让宿主可以介入
      yield { type: "agent.tool_pending", toolName, args };
      const toolResult = yield* this.executeTool(...);
      yield { type: "agent.tool_result", toolName, result: toolResult };
    } else {
      // Agent 决定回复，结束循环
      yield { type: "agent.final_answer", content: thought };
      break;
    }
  }
}
```

---

### 2.4 消息历史管理（中优先级）

#### 现状

Agent 的对话历史完全封装在 PI host 内部，工作流层面看不到消息列表：

```typescript
// 当前：只能传 system_prompt + user_prompt，没有消息历史概念
{
  "inputs": {
    "system_prompt": { "from": "literal", "value": "你是一个助手" },
    "user_prompt": { "from": "run.input", "path": "text" }
  }
}
```

#### LangChain 的做法

LangChain 的 Memory 抽象管理消息历史：

```python
# LangChain: 消息历史是一等公民
messages = [
    SystemMessage("你是一个助手"),
    HumanMessage("你好"),
    AIMessage("你好！有什么可以帮你的？"),
    HumanMessage("给我讲个笑话"),
]

# 多种 Memory 策略
memory = ConversationBufferMemory()           # 完整历史
memory = ConversationSummaryMemory(llm=llm)   # 摘要压缩
memory = ConversationTokenBufferMemory(llm=llm, max_tokens=2000)  # Token 限制
```

#### 借鉴建议

在 pi-workflow 中支持消息历史作为一等数据类型：

```typescript
// 方案：在 DSL 中支持 messages 输入
{
  "id": "chat-agent",
  "executor": { "type": "agent" },
  "inputs": {
    "system_prompt": { "from": "literal", "value": "你是一个助手" },
    "messages": { "from": "context", "path": "chat_history" }  // 传入消息列表
  },
  "output": {
    "to": "chat_history",
    "mergeStrategy": "append-array"  // 追加新消息到历史
  }
}
```

运行时支持消息格式：

```typescript
interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: Array<{
    readonly id: string;
    readonly type: "function";
    readonly function: { readonly name: string; readonly arguments: string };
  }>;
}
```

配合 `template` 节点做历史裁剪：

```json
{
  "id": "trim-history",
  "executor": { "type": "code" },
  "inputs": {
    "script": { "from": "literal", "value": "const msgs = context.messages || []; return msgs.slice(-20);" }
  },
  "output": { "to": "messages" }
}
```

---

### 2.5 流式事件粒度和 Debug API（低优先级）

#### 现状

已有 `node.progress` 事件，但粒度较粗且只有 AgentExecutor 使用：

```typescript
// 当前事件
{ type: "node.progress", message: "工具调用: read", delta?: "..." }
{ type: "node.progress", message: "工具完成: read" }
```

#### 借鉴建议

细化事件体系并增加 Debug API：

```typescript
// 细粒度事件类型
type WorkflowRuntimeEvent = 
  // 工作流生命周期
  | { type: "workflow.started"; workflowRunId: string; workflowId: string }
  | { type: "workflow.completed"; workflowRunId: string; finalOutput?: unknown }
  | { type: "workflow.failed"; workflowRunId: string; error: string }
  | { type: "workflow.paused"; workflowRunId: string; interaction: WorkflowInteraction }
  
  // 帧/节点生命周期
  | { type: "frame.entered"; ... }
  | { type: "node.started"; ... }
  | { type: "node.completed"; ... }
  | { type: "node.failed"; ... }
  
  // 细粒度进度事件（新增子类型）
  | { type: "node.progress"; subType: "text_delta"; nodeId: string; delta: string }
  | { type: "node.progress"; subType: "tool_call"; nodeId: string; toolName: string; args: unknown }
  | { type: "node.progress"; subType: "tool_result"; nodeId: string; toolName: string; result: unknown }
  | { type: "node.progress"; subType: "state_change"; nodeId: string; path: string; oldValue: unknown; newValue: unknown }
  
  // 安全事件
  | { type: "security.decision"; ... }
  | { type: "node.pending_approval"; nodeId: string; capability: string; reason: string }
  
  // 调试事件（新增，默认 silent）
  | { type: "debug.value_resolved"; nodeId: string; binding: string; resolvedValue: unknown }
  | { type: "debug.plan_step"; plannedNodes: string[] }
  | { type: "debug.schedule_tick"; readyNodes: string[] };
```

Debug API：

```typescript
interface DebugAPI {
  // 获取执行时间线
  getTimeline(runId: string): TimelineEntry[];
  
  // 获取节点执行详情
  getNodeDetail(runId: string, nodeId: string): NodeExecutionDetail;
  
  // 获取状态变更历史
  getStateHistory(runId: string): StateSnapshot[];
  
  // 安全审计
  getSecurityAudit(runId: string): SecurityDecisionEvent[];
}
```

---

## 三、总结与建议路线

### 优先级路线图

```
Phase 1（当前可做，改动量小）
├── 2.2 条件路由（IR + Scheduler 扩展）
└── 2.5 事件细化（事件类型扩展，默认 silent 不破坏现有宿主）

Phase 2（核心重构，改动量中）
├── 2.1 显式 State（store 升级 + DSL 扩展）
├── 2.4 消息历史（AgentInput 扩展 + 运行时支持）
└── Debug API（基于已有 EventRecorder 封装）

Phase 3（能力跃升，改动量大）
├── 2.3 Agent 循环显式化（新节点类型 + AgentExecutor 重构）
└── 子图/模板复用（IR 扩展 + 加载器增强）
```

### 关键设计原则

1. **向后兼容**：所有新功能以增量方式加入，不破坏现有 DSL 和运行时
2. **渐进采用**：显式 State 是可选的，不声明时退化为当前的 `Record<string, unknown>`
3. **宿主无关**：事件流保持 AsyncGenerator 模式，宿主按需消费
4. **可组合**：条件路由 + 显式 State + Agent 循环显式化，三者组合可以表达 LangGraph 的所有模式

### 与 LangGraph 的定位差异保持

pi-workflow 不应该变成 LangGraph 的 TypeScript 克隆，而应该保持自己的优势：

| 保留的优势 | 说明 |
|------------|------|
| 声明式 DSL | JSON/TOML 配置，非开发者可用 |
| 宿主无关 | 可嵌入 TUI、CLI、Web、VSCode 扩展 |
| ValueRef 系统 | 编译期可分析的引用关系 |
| 安全模型 | 权限检查 + 审计日志 |
| 16 种执行器 | 开箱即用的节点类型 |

借鉴的目标是**补强而不是模仿**——用 LangGraph 的设计思想来补 pi-workflow 在动态路由和状态管理上的短板，同时保持声明式、宿主无关的核心优势。
