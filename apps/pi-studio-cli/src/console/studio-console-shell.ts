/**
 * 宿主级控制台 shell 主循环。
 *
 * 职责：
 * 1. 启动交互式 REPL
 * 2. 管理控制台生命周期（进入 -> 运行 -> 退出）
 * 3. 协调 command router、renderer、state 的交互
 * 4. 自然语言输入 → PI CustomAgentInvoker 流式调用
 */

import * as readline from "node:readline";
import pc from "picocolors";
import ora from "ora";
import type { Ora } from "ora";
import {
  createInitialState,
  addMessage,
  setLoading,
  setError,
  clearError,
  setInputMode,
  type StudioConsoleState,
} from "./studio-state.js";
import { renderView, renderPrompt, renderSystemMessage } from "./studio-renderer.js";
import {
  createDefaultRouter,
  parseInput,
  isStudioCommand,
  type CommandRouter,
} from "./studio-command-router.js";

/** 控制台启动横幅 — PI 风格结构化日志。 */
const WELCOME_BANNER = [
  `${pc.cyan("[studio]")} ${pc.cyan("▶")} pi-studio 宿主控制台`,
  `${pc.cyan("[studio]")} ${pc.dim("输入 /help 查看命令，直接输入文本由 AI 助手处理，/exit 退出")}`,
  "",
].join("\n");

/** shell 运行时依赖。 */
export interface ConsoleShellDeps {
  /** 命令路由表 */
  router: CommandRouter;
}

/**
 * 启动宿主级控制台 REPL。
 */
export async function startStudioConsole(deps?: Partial<ConsoleShellDeps>): Promise<void> {
  const router = deps?.router ?? createDefaultRouter();

  let state = createInitialState();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // 输出欢迎横幅
  console.log(WELCOME_BANNER);

  // 首次渲染 home 视图
  console.log(renderView(state));

  // 设置提示符并开始等待输入
  rl.setPrompt(renderPrompt(state));
  rl.prompt();

  // 主循环
  for await (const line of rl) {
    const input = line.trim();

    // 空输入跳过
    if (input === "") {
      rl.setPrompt(renderPrompt(state));
      rl.prompt();
      continue;
    }

    // 记录用户输入
    state = addMessage(state, {
      role: "user",
      content: input,
      timestamp: new Date(),
    });

    // 解析输入
    const parsed = parseInput(input);

    if (parsed.isCommand) {
      const result = await handleCommand(state, parsed.command, parsed.args, router);
      if (result.exit) {
        console.log(renderSystemMessage("正在退出 pi-studio 控制台..."));
        rl.close();
        break;
      }
      state = result.state;
    } else {
      state = await handleAssistantStreaming(state, parsed.text);
    }

    // 更新提示符
    rl.setPrompt(renderPrompt(state));
    rl.prompt();
  }

  rl.close();
}

/**
 * 处理 slash command。
 */
async function handleCommand(
  state: StudioConsoleState,
  command: string,
  args: string[],
  router: CommandRouter,
): Promise<{ state: StudioConsoleState; exit?: boolean }> {
  if (!isStudioCommand(command)) {
    // 未知命令
    const msg = `未知命令: ${command}。输入 /help 查看可用命令。`;
    state = addMessage(state, {
      role: "system",
      content: msg,
      timestamp: new Date(),
    });
    state = setError(state, msg);
    console.log(renderView(state));
    state = clearError(state);
    return { state };
  }

  const handler = router.get(command);
  if (!handler) {
    const msg = `命令 ${command} 未注册处理器。`;
    state = setError(state, msg);
    console.log(renderView(state));
    state = clearError(state);
    return { state };
  }

  try {
    const result = await handler(state, args);
    state = result.state;

    // /exit /quit 不渲染视图，直接返回信号给主循环
    if (result.exit) {
      return { state, exit: true };
    }

    if (result.output) {
      state = addMessage(state, {
        role: "system",
        content: result.output,
        timestamp: new Date(),
      });
      console.log(renderSystemMessage(result.output));
    }

    console.log(renderView(state));
    return { state };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state = addMessage(setError(state, msg), {
      role: "system",
      content: `命令执行失败: ${msg}`,
      timestamp: new Date(),
    });
    console.log(renderView(state));
    state = clearError(state);
    return { state };
  }
}

/**
 * 处理自然语言输入 — 流式调用 PI agent runtime。
 *
 * 对标 pi-workflow agent once 的模式：
 *   CustomAgentInvoker.invoke() → AsyncGenerator<WorkflowHostEvent>
 *   → renderStreamEvent() → 实时写入 stdout
 *
 * 流式渲染输出示例：
 *   [AI] ▶ 正在处理...
 *   [AI] 好的，我来帮你...
 *   [TOOL] ↳ 调用工具: create_workflow_draft
 *   [TOOL] ✓ 工具完成: create_workflow_draft
 *   [AI] 已生成工作流草稿...
 */
import { renderAiStart, renderAiEnd, renderAiUnavailable, renderStreamEvent } from "./studio-stream-renderer.js";

async function handleAssistantStreaming(
  state: StudioConsoleState,
  input: string,
): Promise<StudioConsoleState> {
  state = setInputMode(setLoading(state, true), "assistant");

  const spinner = ora({ text: "AI 思考中...", color: "magenta" }).start();
  try {
    // 尝试通过 PI CustomAgentInvoker 流式调用
    const result = await invokeWithPiRuntime(input, spinner);

    if (result === null) {
      // 无模型可用：回退到关键字匹配
      spinner.stop();
      const { invokePiAssistant } = await import("./studio-pi-bridge.js");
      console.log(renderAiUnavailable());
      const response = await invokePiAssistant(input);
      state = addMessage(setLoading(state, false), {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });
      console.log(renderSystemMessage(`AI 助手: ${response}`));
    } else {
      // 流式调用成功 — spinner 已在 invokeWithPiRuntime 内部停止
      state = addMessage(setLoading(state, false), {
        role: "assistant",
        content: result,
        timestamp: new Date(),
      });
      console.log(renderAiEnd());
    }
  } catch (err) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    state = addMessage(setLoading(setError(state, msg), false), {
      role: "system",
      content: `AI 助手调用失败: ${msg}`,
      timestamp: new Date(),
    });
    console.log(renderView(state));
    state = clearError(state);
  }

  state = setInputMode(state, "shell");
  return state;
}

/**
 * 通过 PI CustomAgentInvoker 流式调用 studio-console agent。
 *
 * @returns 累积的完整响应文本，或 null（模型不可用时）
 */
async function invokeWithPiRuntime(input: string, spinner?: Ora): Promise<string | null> {
  const modelId = process.env["PI_STUDIO_MODEL"]
    ?? process.env["PI_WORKFLOW_TEST_MODEL"]
    ?? process.env["PI_WORKFLOW_DEFAULT_MODEL"];

  if (!modelId) {
    return null;
  }

  try {
    const { PiHostAdapter } = await import("@pi-workflow/core");
    const { registerBuiltinTools } = await import("@pi-workflow/builtin-tools");
    const { CustomAgentInvoker } = await import("@pi-workflow/core");
    const { AgentRegistry } = await import("@pi-workflow/core");

    const host = new PiHostAdapter({
      builtinTools: registerBuiltinTools(),
      permissionCheck: () => ({ allowed: true }),
    });

    // 构建 studio-console 的 assembly
    const registry = new AgentRegistry();
    const [provider, model] = modelId.includes("/")
      ? modelId.split("/")
      : ["anthropic", modelId];

    registry.register({
      id: "studio-console",
      name: "Studio Console Assistant",
      description: "pi-studio 控制台 AI 助手",
      systemPrompt: buildStudioConsoleSystemPrompt(),
      model: { provider, model },
      runtime: { mode: "pi-tui" },
    });

    const invoker = new CustomAgentInvoker({ host, registry });

    // 停止 spinner（在 PI runtime 初始化期间显示），切换到流式 UI
    spinner?.stop();
    console.log(renderAiStart());

    let content = "";
    const gen = invoker.invoke({
      agentId: "studio-console",
      prompt: input,
      model: modelId,
    });

    for await (const event of gen) {
      const result = renderStreamEvent(event, content);
      content = result.content;
    }

    // 结束换行
    if (content.length > 0 && !content.endsWith("\n")) {
      process.stdout.write("\n");
    }

    return content || null;
  } catch {
    spinner?.stop();
    return null;
  }
}

/** studio-console agent 的 system prompt。 */
function buildStudioConsoleSystemPrompt(): string {
  return `你是 pi-studio 控制台的 AI 助手 (studio-console)。

你的职责：
1. 理解用户的自然语言请求
2. 帮助用户浏览已注册的 workflows、agents、skills、tools、resources
3. 根据用户描述生成 workflow 和 agent 草稿
4. 给出结构化宿主动作建议

当前你可以：
- 回答与 workflow、agent 相关的问题
- 给出操作建议

注意：
- 使用中文回答
- 简洁、直接，不要过度解释`;
}
