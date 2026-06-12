/**
 * 控制台状态模型。
 *
 * 职责：
 * 1. 管理控制台当前视图、负载、光标位置
 * 2. 提供不可变的状态转换函数
 * 3. 跟踪控制台运行模式（shell / assistant）
 */

/** 控制台可以处于的不同视图。 */
export type ConsoleView =
  | "home"
  | "workflows"
  | "agents"
  | "skills"
  | "tools"
  | "resources"
  | "runs"
  | "create-workflow"
  | "create-agent"
  | "help";

/** 输入模式：slash command 解析 vs. 自然语言转交 assistant。 */
export type InputMode = "shell" | "assistant";

/** 单条控制台消息（用户输入或系统响应）。 */
export interface ConsoleMessage {
  readonly role: "user" | "system" | "assistant";
  readonly content: string;
  readonly timestamp: Date;
}

/** 控制台完整状态。 */
export interface StudioConsoleState {
  /** 当前视图 */
  readonly view: ConsoleView;
  /** 当前输入模式 */
  readonly inputMode: InputMode;
  /** 是否正在运行中（loading 指示） */
  readonly loading: boolean;
  /** 当前视图所承载的数据（列表 / 详情 / 草稿） */
  readonly payload: unknown;
  /** 消息历史（shell 模式下的 command/response 对） */
  readonly messages: readonly ConsoleMessage[];
  /** 上一次错误信息 */
  readonly lastError: string | null;
}

/** 创建初始控制台状态。 */
export function createInitialState(): StudioConsoleState {
  return {
    view: "home",
    inputMode: "shell",
    loading: false,
    payload: null,
    messages: [],
    lastError: null,
  };
}

/** 状态转换：切换到指定视图。 */
export function navigateTo(
  state: StudioConsoleState,
  view: ConsoleView,
): StudioConsoleState {
  return {
    ...state,
    view,
    payload: null,
    lastError: null,
    messages: [...state.messages],
  };
}

/** 状态转换：设置输入模式。 */
export function setInputMode(
  state: StudioConsoleState,
  mode: InputMode,
): StudioConsoleState {
  return { ...state, inputMode: mode };
}

/** 状态转换：添加一条消息。 */
export function addMessage(
  state: StudioConsoleState,
  message: ConsoleMessage,
): StudioConsoleState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/** 状态转换：设置 loading 标志。 */
export function setLoading(
  state: StudioConsoleState,
  loading: boolean,
): StudioConsoleState {
  return { ...state, loading };
}

/** 状态转换：更新视图负载。 */
export function setPayload(
  state: StudioConsoleState,
  payload: unknown,
): StudioConsoleState {
  return { ...state, payload };
}

/** 状态转换：记录错误。 */
export function setError(
  state: StudioConsoleState,
  error: string,
): StudioConsoleState {
  return { ...state, lastError: error, loading: false };
}

/** 状态转换：清除错误。 */
export function clearError(state: StudioConsoleState): StudioConsoleState {
  return { ...state, lastError: null };
}
