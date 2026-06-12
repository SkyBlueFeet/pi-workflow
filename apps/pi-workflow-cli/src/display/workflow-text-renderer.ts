import type { WorkflowDisplaySnapshot } from "./workflow-display-model.js";
import type { WorkflowDisplayEvent } from "./workflow-display-events.js";
import type { WorkflowDisplayRenderOptions, WorkflowDisplayRenderer } from "./workflow-display-renderer.js";

/** 文本渲染器用于非 TTY 与日志场景，保持逐行输出与最终结果可读。 */
export class WorkflowTextRenderer implements WorkflowDisplayRenderer {
  private readonly showFinalOutput: boolean;
  private streamingNodeId?: string;

  constructor(options: WorkflowDisplayRenderOptions = {}) {
    this.showFinalOutput = options.showFinalOutput ?? false;
  }

  start(snapshot: WorkflowDisplaySnapshot): void {
    console.log(`工作流: ${snapshot.title ?? snapshot.workflowId ?? "<unknown>"}\n`);
  }

  renderEvent(event: WorkflowDisplayEvent, snapshot: WorkflowDisplaySnapshot): void {
    switch (event.type) {
      case "display.workflow.resumed":
        console.log(`工作流恢复: ${event.workflowId}`);
        break;
      case "display.node.started":
        this.streamingNodeId = event.nodeId;
        console.log(`  └─ ${event.title || event.nodeId}`);
        break;
      case "display.agent.message.delta":
        if (this.streamingNodeId === event.nodeId) {
          process.stdout.write(event.delta);
        }
        break;
      case "display.agent.tool.started":
        this.ensureTrailingNewline();
        console.log(`  工具调用: ${event.toolName}`);
        break;
      case "display.agent.tool.completed":
        this.ensureTrailingNewline();
        console.log(`  工具完成: ${event.toolName}`);
        break;
      case "display.node.completed":
        if (this.streamingNodeId === event.nodeId) {
          process.stdout.write("\n");
          this.streamingNodeId = undefined;
        }
        console.log(`  ✓ ${event.nodeId}`);
        break;
      case "display.node.failed":
        this.ensureTrailingNewline();
        console.error(`  ✗ ${event.nodeId}: ${event.error}`);
        break;
      case "display.node.await_input":
        this.ensureTrailingNewline();
        console.log(`  ⏸ ${event.nodeId} 等待输入`);
        console.log(`    问题: ${event.interaction.question}`);
        break;
      case "display.workflow.paused":
        this.ensureTrailingNewline();
        console.log(`\n工作流已暂停 (${event.workflowRunId})`);
        console.log(`  问题: ${event.interaction.question}`);
        console.log(`  恢复: pi-workflow resume ${event.workflowRunId}`);
        break;
      case "display.workflow.completed":
        this.ensureTrailingNewline();
        if (this.showFinalOutput) {
          console.log(`\n结果:\n${JSON.stringify(event.finalOutput, null, 2)}`);
        }
        break;
      case "display.workflow.failed":
        this.ensureTrailingNewline();
        console.error(`\n✗ 工作流失败: ${event.error}`);
        break;
      default:
        break;
    }
  }

  finish(snapshot: WorkflowDisplaySnapshot): void {
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
