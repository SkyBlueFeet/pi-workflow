/**
 * 无头模式扩展 API，为扩展包提供不依赖 UI 环境的注册与执行能力。
 * 扩展包通过 default export 接收此实例，并调用其方法完成工具与事件注册。
 */
export class HeadlessExtensionAPI {
  readonly tools: Array<{ name: string; description?: string; parameters?: unknown; execute?: (...args: unknown[]) => unknown }> = [];
  readonly events: { emit: (event: string, payload?: unknown) => void; on?: (event: string, handler: unknown) => void } = {
    emit: () => {},
    on: () => {},
  };

  /**
   * 注册一个扩展工具。
   *
   * @param tool 工具对象，需包含 name、execute 等字段
   */
  registerTool(tool: any): void {
    this.tools.push(tool);
  }

  /** 注册命令（无头模式下为空操作）。 */
  registerCommand(_name: string, _options: any): void {}
  /** 注册快捷键（无头模式下为空操作）。 */
  registerShortcut(_shortcut: string, _options: any): void {}
  /** 注册自定义 flag（无头模式下为空操作）。 */
  registerFlag(_name: string, _options: any): void {}
  /** 获取已注册 flag 的值（无头模式下始终返回 undefined）。 */
  getFlag(_name: string): undefined { return undefined; }
  /** 注册自定义消息渲染器（无头模式下为空操作）。 */
  registerMessageRenderer(_customType: string, _renderer: any): void {}
  /** 发送消息（无头模式下为空操作）。 */
  sendMessage(_message: any, _options?: any): void {}
  /** 发送用户消息（无头模式下为空操作）。 */
  sendUserMessage(_content: any, _options?: any): void {}
  /** 追加对话条目（无头模式下为空操作）。 */
  appendEntry(_customType: string, _data?: unknown): void {}
  /** 设置会话名称（无头模式下为空操作）。 */
  setSessionName(_name: string): void {}
  /** 获取会话名称（无头模式下始终返回 undefined）。 */
  getSessionName(): undefined { return undefined; }
  /** 设置条目标签（无头模式下为空操作）。 */
  setLabel(_entryId: string, _label: string | undefined): void {}
  /**
   * 执行系统命令（无头模式下返回空结果）。
   *
   * @returns 始终返回成功退出码与空输出
   */
  exec(_command: string, _args: string[], _options?: any): Promise<any> {
    return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
  }
  /** 获取当前激活的工具名列表（无头模式下返回空数组）。 */
  getActiveTools(): string[] { return []; }
  /**
   * 获取所有已注册工具元信息（名称、描述、参数）。
   *
   * @returns 工具元信息数组
   */
  getAllTools(): any[] { return this.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })); }
  /** 设置激活的工具列表（无头模式下为空操作）。 */
  setActiveTools(_toolNames: string[]): void {}
  /** 获取已注册命令列表（无头模式下返回空数组）。 */
  getCommands(): any[] { return []; }
  /**
   * 设置模型配置（无头模式下始终返回 false）。
   *
   * @returns 始终返回 false 表示不支持
   */
  setModel(_model: any): Promise<boolean> { return Promise.resolve(false); }
  /** 获取当前思考级别（无头模式下返回 "none"）。 */
  getThinkingLevel(): any { return "none"; }
  /** 设置思考级别（无头模式下为空操作）。 */
  setThinkingLevel(_level: any): void {}
  /** 注册 Provider（无头模式下为空操作）。 */
  registerProvider(_name: string, _config: any): void {}
  /** 注销 Provider（无头模式下为空操作）。 */
  unregisterProvider(_name: string): void {}
  /** 注册事件监听（无头模式下为空操作）。 */
  on(_event: string, _handler: any): void {}
}
