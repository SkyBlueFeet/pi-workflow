import type { WorkflowRuntimeEvent } from "@pi-workflow/core";
import type { WorkflowShellSnapshot } from "./workflow-view-model.js";

export interface WorkflowRenderer {
  start(snapshot: WorkflowShellSnapshot): void;
  renderEvent(event: WorkflowRuntimeEvent, snapshot: WorkflowShellSnapshot): void;
  finish(snapshot: WorkflowShellSnapshot): void;
}

/** 根据模式选择第一阶段 renderer。 */
export function createWorkflowRenderer(_mode: "text"): WorkflowRenderer {
  return new WorkflowTextRenderer();
}

/** 文本渲染器用于非 TTY 和测试场景，保持对现有 CLI 文案风格的兼容。 */
export class WorkflowTextRenderer implements WorkflowRenderer {
  private streamingNodeId?: string;

  start(snapshot: WorkflowShellSnapshot): void {
    console.log(`工作流: ${snapshot.title ?? snapshot.workflowId ?? "<unknown>"}\n`);
  }

  renderEvent(event: WorkflowRuntimeEvent, snapshot: WorkflowShellSnapshot): void {
    switch (event.type) {
      case "workflow.resumed":
        console.log(`工作流恢复: ${event.workflowId}`);
        break;
      case "node.started":
        this.streamingNodeId = event.nodeId;
        console.log(`  └─ ${event.title || event.nodeId}`);
        break;
      case "agent.message.delta":
        if (this.streamingNodeId === event.nodeId) {
          process.stdout.write(event.delta);
        }
        break;
      case "agent.tool.started":
        this.ensureTrailingNewline();
        console.log(`  工具调用: ${event.toolName}`);
        break;
      case "agent.tool.completed":
        this.ensureTrailingNewline();
        console.log(`  工具完成: ${event.toolName}`);
        break;
      case "node.completed":
        if (this.streamingNodeId === event.nodeId) {
          process.stdout.write("\n");
          this.streamingNodeId = undefined;
        }
        console.log(`  ✓ ${event.nodeId}`);
        break;
      case "node.failed":
        this.ensureTrailingNewline();
        console.error(`  ✗ ${event.nodeId}: ${event.error}`);
        break;
      case "node.await_input":
        this.ensureTrailingNewline();
        console.log(`  ⏸ ${event.nodeId} 等待输入`);
        break;
      case "workflow.paused":
        this.ensureTrailingNewline();
        console.log(`\n工作流已暂停 (${event.workflowRunId})`);
        console.log(`  恢复: pi-workflow resume ${event.workflowRunId}`);
        break;
      case "workflow.completed":
        this.ensureTrailingNewline();
        console.log(`\n结果:\n${JSON.stringify(event.finalOutput, null, 2)}`);
        break;
      case "workflow.failed":
        this.ensureTrailingNewline();
        console.error(`\n✗ 工作流失败: ${event.error}`);
        break;
      case "node.progress":
        if (!("delta" in event) || !event.delta) {
          return;
        }
        break;
      default:
        break;
    }
  }

  finish(snapshot: WorkflowShellSnapshot): void {
    if (snapshot.status === "failed" && snapshot.latestError) {
      return;
    }
  }

  private ensureTrailingNewline(): void {
    if (this.streamingNodeId) {
      process.stdout.write("\n");
      this.streamingNodeId = undefined;
    }
  }
}
