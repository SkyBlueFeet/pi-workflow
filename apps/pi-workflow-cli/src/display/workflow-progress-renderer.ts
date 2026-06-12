import type { WorkflowDisplaySnapshot } from "./workflow-display-model.js";
import type { WorkflowDisplayEvent } from "./workflow-display-events.js";
import type { WorkflowDisplayRenderOptions, WorkflowDisplayRenderer } from "./workflow-display-renderer.js";
import {
  DefaultWorkflowTerminalCoordinator,
  registerWorkflowTerminalCoordinator,
} from "./workflow-terminal-coordinator.js";

const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";

/** 进度渲染器采用彩色结构化日志，不做覆盖式重绘，兼容宿主/子进程输出环境。 */
export class WorkflowProgressRenderer implements WorkflowDisplayRenderer {
  private readonly terminalCoordinator = new DefaultWorkflowTerminalCoordinator();
  private readonly showFinalOutput: boolean;
  private lastPrintedStatus?: string;
  private lastPrintedToolKey?: string;
  private lastPrintedQuestionId?: string;
  private outputBuffers = new Map<string, string>();

  constructor(options: WorkflowDisplayRenderOptions = {}) {
    this.showFinalOutput = options.showFinalOutput ?? false;
  }

  start(snapshot: WorkflowDisplaySnapshot): void {
    registerWorkflowTerminalCoordinator(this.terminalCoordinator);
    console.log(`${colorize("WF", ANSI_CYAN)} ${snapshot.title ?? snapshot.workflowId ?? "<unknown>"} ${colorize("IDLE", ANSI_DIM)}`);
  }

  renderEvent(event: WorkflowDisplayEvent, snapshot: WorkflowDisplaySnapshot): void {
    switch (event.type) {
      case "display.workflow.started":
      case "display.workflow.resumed":
        this.printWorkflowStatus(snapshot);
        break;
      case "display.node.started":
        console.log(`${colorize("NODE", ANSI_BLUE)} ${colorize("▶", ANSI_BLUE)} ${event.title ?? event.nodeId}`);
        this.outputBuffers.delete(event.nodeId);
        break;
      case "display.node.progress":
        if (shouldPrintStepMessage(event.message) && snapshot.latestStatusText && snapshot.latestStatusText !== this.lastPrintedStatus) {
          console.log(`${colorize("STEP", ANSI_CYAN)} ${snapshot.latestStatusText}`);
          this.lastPrintedStatus = snapshot.latestStatusText;
        }
        break;
      case "display.agent.message.delta":
        this.bufferAgentDelta(event.nodeId, event.delta);
        break;
      case "display.agent.tool.started":
        this.flushAgentOutput(event.nodeId);
        this.printToolActivity(event.nodeId, event.toolName, "started");
        break;
      case "display.agent.tool.completed":
        this.flushAgentOutput(event.nodeId);
        this.printToolActivity(event.nodeId, event.toolName, "completed");
        break;
      case "display.node.await_input":
        this.flushAgentOutput(event.nodeId);
        this.printQuestion(event.interaction.interactionId, event.interaction.question);
        break;
      case "display.node.completed":
        this.flushAgentOutput(event.nodeId);
        console.log(`${colorize("NODE", ANSI_GREEN)} ${colorize("✓", ANSI_GREEN)} ${event.nodeId}`);
        break;
      case "display.node.failed":
        this.flushAgentOutput(event.nodeId);
        console.error(`${colorize("NODE", ANSI_RED)} ${colorize("✗", ANSI_RED)} ${event.nodeId}: ${event.error}`);
        break;
      case "display.workflow.paused":
        this.printQuestion(event.interaction.interactionId, event.interaction.question, snapshot.workflowRunId);
        break;
      case "display.workflow.completed":
        this.printWorkflowStatus(snapshot);
        if (this.showFinalOutput) {
          console.log(`结果:\n${JSON.stringify(event.finalOutput, null, 2)}`);
        }
        break;
      case "display.workflow.failed":
        this.printWorkflowStatus(snapshot);
        console.error(`错误: ${event.error}`);
        break;
    }
  }

  finish(_snapshot: WorkflowDisplaySnapshot): void {
    return;
  }

  private printWorkflowStatus(snapshot: WorkflowDisplaySnapshot): void {
    const statusLabel = renderStatusLabel(snapshot.status);
    console.log(`${colorize("WF", ANSI_CYAN)} ${snapshot.title ?? snapshot.workflowId ?? "<unknown>"} ${statusLabel}`);
  }

  private bufferAgentDelta(nodeId: string, delta: string): void {
    const next = `${this.outputBuffers.get(nodeId) ?? ""}${delta}`;
    this.outputBuffers.set(nodeId, next);
    const flushed = flushRenderableSegments(next);
    if (flushed.lines.length === 0) {
      return;
    }
    this.outputBuffers.set(nodeId, flushed.rest);
    for (const line of flushed.lines) {
      console.log(`${colorize("OUT", ANSI_DIM)} ${truncateLine(line)}`);
    }
  }

  private flushAgentOutput(nodeId: string): void {
    const rest = this.outputBuffers.get(nodeId)?.trim();
    if (rest) {
      console.log(`${colorize("OUT", ANSI_DIM)} ${truncateLine(rest)}`);
    }
    this.outputBuffers.delete(nodeId);
  }

  private printToolActivity(nodeId: string, toolName: string, status: "started" | "completed"): void {
    const key = `${nodeId}:${toolName}:${status}`;
    if (this.lastPrintedToolKey === key) {
      return;
    }
    this.lastPrintedToolKey = key;
    const symbol = status === "started" ? colorize("↳", ANSI_YELLOW) : colorize("✓", ANSI_GREEN);
    const label = status === "started" ? "调用工具" : "工具完成";
    console.log(`${colorize("TOOL", ANSI_YELLOW)} ${symbol} ${label}: ${toolName}`);
  }

  private printQuestion(interactionId: string, question: string, workflowRunId?: string): void {
    if (this.lastPrintedQuestionId === interactionId) {
      return;
    }
    this.lastPrintedQuestionId = interactionId;
    console.log(`${colorize("ASK", ANSI_YELLOW)} ${colorize("?", ANSI_YELLOW)} ${question}`);
    if (workflowRunId) {
      console.log(`${colorize("ASK", ANSI_DIM)} 恢复命令: pi-workflow resume ${workflowRunId}`);
    }
  }
}

function renderStatusLabel(status: WorkflowDisplaySnapshot["status"]): string {
  switch (status) {
    case "running":
      return colorize("RUNNING", ANSI_BLUE);
    case "paused":
      return colorize("PAUSED", ANSI_YELLOW);
    case "completed":
      return colorize("COMPLETED", ANSI_GREEN);
    case "failed":
      return colorize("FAILED", ANSI_RED);
    default:
      return colorize("IDLE", ANSI_DIM);
  }
}

function colorize(text: string, color: string): string {
  return `${color}[${text}]${ANSI_RESET}`;
}

function truncateLine(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= 96) {
    return normalized;
  }
  return `${normalized.slice(0, 93)}...`;
}

function shouldPrintStepMessage(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  if (normalized.length <= 3) {
    return false;
  }
  return normalized.startsWith("工具调用:")
    || normalized.startsWith("工具完成:")
    || normalized.startsWith("正在")
    || normalized.startsWith("已")
    || normalized.startsWith("完成")
    || normalized.startsWith("失败");
}

function flushRenderableSegments(buffer: string): { readonly lines: readonly string[]; readonly rest: string } {
  const lines: string[] = [];
  let cursor = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (!char) {
      continue;
    }
    if (!isFlushBoundary(char)) {
      continue;
    }
    const segment = buffer.slice(cursor, index + 1).trim();
    if (segment) {
      lines.push(segment);
    }
    cursor = index + 1;
  }

  return {
    lines,
    rest: buffer.slice(cursor),
  };
}

function isFlushBoundary(char: string): boolean {
  return char === "\n"
    || char === "。"
    || char === "！"
    || char === "？"
    || char === "，"
    || char === ","
    || char === "."
    || char === "!"
    || char === "?";
}
