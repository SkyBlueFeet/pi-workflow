/**
 * 宿主级控制台 shell 主循环。
 *
 * 职责：
 * 1. 启动交互式 REPL
 * 2. 管理控制台生命周期（进入 -> 运行 -> 退出）
 * 3. 协调 command router、renderer、state 的交互
 * 4. 将自然语言输入转发给 AI 助手
 */

import * as readline from "node:readline";
import {
  createInitialState,
  addMessage,
  setLoading,
  setError,
  clearError,
  setInputMode,
  type StudioConsoleState,
} from "./studio-state.js";
import { renderView, renderPrompt, renderSystemMessage, renderHelp } from "./studio-renderer.js";
import {
  createDefaultRouter,
  parseInput,
  isStudioCommand,
  type CommandRouter,
} from "./studio-command-router.js";

/** 控制台启动横幅。 */
const WELCOME_BANNER = [
  "\u001b[1m\u001b[36m",
  "  ╔══════════════════════════════════════════════════╗",
  "  ║              pi-studio 控制台                      ║",
  "  ║              产品级宿主入口                        ║",
  "  ╚══════════════════════════════════════════════════╝",
  "\u001b[0m",
  "",
  "  输入 /help 查看可用命令，输入 exit 退出",
  "  直接输入自然语言将由 AI 助手 (studio-console) 处理",
  "",
].join("\n");

/** shell 运行时依赖。 */
export interface ConsoleShellDeps {
  /** 命令路由表 */
  router: CommandRouter;
  /** 可选：AI 助手接线函数 */
  assistantHandler?: (state: StudioConsoleState, input: string) => Promise<string>;
}

/**
 * 启动宿主级控制台 REPL。
 *
 * @param deps 可选依赖注入，默认使用创建的路由器和空助手
 */
export async function startStudioConsole(deps?: Partial<ConsoleShellDeps>): Promise<void> {
  const router = deps?.router ?? createDefaultRouter();
  const assistantHandler = deps?.assistantHandler ?? defaultAssistantHandler;

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

    // 退出命令
    if (input === "exit" || input === "quit") {
      console.log(renderSystemMessage("正在退出 pi-studio 控制台..."));
      rl.close();
      break;
    }

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
      state = await handleCommand(state, parsed.command, parsed.args, router);
    } else {
      state = await handleAssistant(state, parsed.text, assistantHandler);
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
): Promise<StudioConsoleState> {
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
    return state;
  }

  const handler = router.get(command);
  if (!handler) {
    const msg = `命令 ${command} 未注册处理器。`;
    state = setError(state, msg);
    console.log(renderView(state));
    state = clearError(state);
    return state;
  }

  try {
    const result = await handler(state, args);
    state = result.state;

    if (result.output) {
      state = addMessage(state, {
        role: "system",
        content: result.output,
        timestamp: new Date(),
      });
    }

    // 对于 /help，渲染帮助文本
    if (command === "/help") {
      console.log(renderHelp());
    } else {
      console.log(renderView(state));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state = addMessage(setError(state, msg), {
      role: "system",
      content: `命令执行失败: ${msg}`,
      timestamp: new Date(),
    });
    console.log(renderView(state));
    state = clearError(state);
  }
  return state;
}

/**
 * 处理自然语言输入（转发给 AI 助手）。
 */
async function handleAssistant(
  state: StudioConsoleState,
  input: string,
  handler: (state: StudioConsoleState, input: string) => Promise<string>,
): Promise<StudioConsoleState> {
  state = setInputMode(setLoading(state, true), "assistant");

  try {
    const response = await handler(state, input);
    state = addMessage(setLoading(state, false), {
      role: "assistant",
      content: response,
      timestamp: new Date(),
    });
    console.log(renderSystemMessage(`AI 助手: ${response}`));
  } catch (err) {
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
 * 默认的 AI 助手处理函数（骨架实现）。
 * 后续阶段接入真实的 studio-console agent。
 */
async function defaultAssistantHandler(
  _state: StudioConsoleState,
  input: string,
): Promise<string> {
  return `[studio-console 骨架] 已收到: "${input.slice(0, 100)}"。` +
    ` AI 助手功能将在后续阶段接入真实的 studio-console agent。`;
}
