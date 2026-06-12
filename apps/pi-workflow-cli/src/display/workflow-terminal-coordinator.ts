const WORKFLOW_TERMINAL_COORDINATOR_KEY = "__PI_WORKFLOW_TERMINAL_COORDINATOR__";

export interface WorkflowTerminalCoordinator {
  beforePrompt(lines: readonly string[]): void;
  afterPrompt(): void;
  updateProgress(block: string): void;
  settleProgress(trailingNewline?: boolean): void;
}

/** 将终端显示协调器注册到全局，供 core 宿主提问时读取。 */
export function registerWorkflowTerminalCoordinator(coordinator: WorkflowTerminalCoordinator): void {
  Reflect.set(globalThis, WORKFLOW_TERMINAL_COORDINATOR_KEY, coordinator);
}

/** 读取当前进程中的终端显示协调器；未注册时返回 undefined。 */
export function getWorkflowTerminalCoordinator(): WorkflowTerminalCoordinator | undefined {
  return Reflect.get(globalThis, WORKFLOW_TERMINAL_COORDINATOR_KEY) as WorkflowTerminalCoordinator | undefined;
}

/** 清理终端显示协调器，避免测试之间串扰。 */
export function clearWorkflowTerminalCoordinator(): void {
  Reflect.deleteProperty(globalThis, WORKFLOW_TERMINAL_COORDINATOR_KEY);
}

/** 默认终端协调器：负责让进度区与提问区共存，避免互相覆盖。 */
export class DefaultWorkflowTerminalCoordinator implements WorkflowTerminalCoordinator {
  beforePrompt(lines: readonly string[]): void {
    if (lines.length > 0) {
      process.stdout.write(`${lines.join("\n")}\n`);
    }
  }

  afterPrompt(): void {
    return;
  }

  updateProgress(_block: string): void {
    return;
  }

  settleProgress(_trailingNewline = true): void {
    return;
  }
}
