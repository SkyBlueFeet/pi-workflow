---
**版本锚点**
- 创建时间：2026-05-26 11:00 +08:00
- 最后更新：2026-05-26 11:45 +08:00
- 代码快照日期：2026-05-26

---

# PI npm SDK 调研

## 状态

**RESOLVED** — PI npm SDK 为公开包 `@earendil-works/pi-*`，npm registry 可直接安装。

## 包清单

| 包名 | 用途 | 已安装 |
|---|---|---|
| `@earendil-works/pi-agent-core` | 有状态 Agent：tool 执行、事件流、状态管理 | ✅ |
| `@earendil-works/pi-ai` | 统一 LLM API：多 provider 模型发现、stream/complete、tool 定义、token 跟踪 | ✅ |
| `@earendil-works/pi-coding-agent` | 交互式编码 Agent CLI（pi-workflow 不直接依赖） | ❌ |
| `@earendil-works/pi-tui` | 终端 UI 库（pi-workflow 不直接依赖） | ❌ |

## 核心 API（已验证通过）

### Agent 类（`@earendil-works/pi-agent-core`）

```ts
import { Agent } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  initialState: {
    systemPrompt: "...",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
    tools: [...],
  },
});

agent.subscribe((event) => {
  // agent_start, turn_start, message_start/update/end,
  // tool_execution_start/update/end, turn_end, agent_end
});

await agent.prompt("Hello");
```

### LLM API（`@earendil-works/pi-ai`）

```ts
import { getModel, getModels, getProviders, stream, complete } from "@earendil-works/pi-ai";

const model = getModel("openai", "gpt-4o-mini");

// Streaming
const s = stream(model, context);
for await (const event of s) { /* start, text_delta, toolcall_delta, done, error */ }

// Complete
const response = await complete(model, context);
```

### Tool 定义

```ts
import { Type } from "@earendil-works/pi-ai";

const tool = {
  name: "read_file",
  description: "Read a file",
  parameters: Type.Object({ path: Type.String() }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    return { content: [{ type: "text", text: content }], details: {} };
  },
};
```

### Faux Provider（测试用 mock）

```ts
import { registerFauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";

const reg = registerFauxProvider();
const model = reg.getModel();
reg.setResponses([fauxAssistantMessage([fauxText("Hello")])]);
// model 可配合 Agent 或 stream/complete 使用
reg.unregister();
```

## Provider 覆盖

32 个 provider 可用：OpenAI、Anthropic、Google、DeepSeek、Mistral、xAI、Groq、Cerebras、Amazon Bedrock、OpenRouter 等。

## Adapter 映射

| PI SDK API | Pi Workflow 用途 |
|---|---|
| `Agent` + `prompt()` | `agent` 节点执行器（AgentExecutor） |
| `Agent.subscribe()` | workflow 事件映射（agent 进度 → runtime event） |
| `getModel()` | 模型选择（agent 节点 `model` 字段） |
| Tool 定义格式 | workflow 第三方 tool 注册入口 |
| `registerFauxProvider()` | 测试用 mock host |
