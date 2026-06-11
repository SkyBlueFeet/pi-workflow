import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionRuntime,
} from "@earendil-works/pi-coding-agent";
import type { WorkflowConfig } from "../../config/types.js";
import type { ResolvedPiAgentAssembly } from "../../agents/types.js";
import type { WorkflowRuntime } from "../../runtime/workflow-runtime.js";
import { createPiAgentSessionRuntime } from "./pi-agent-session-runtime.js";
import type { WorkflowPiHostCapabilities } from "./types.js";

/** 嵌入式 agent 子会话事件，仅供 workflow shell 子视图消费。 */
export type EmbeddedAgentSessionEvent =
  | { readonly type: "agent.message"; readonly nodeId: string; readonly role: "user" | "assistant"; readonly text: string }
  | { readonly type: "agent.tool"; readonly nodeId: string; readonly toolName: string; readonly status: "start" | "end" }
  | { readonly type: "agent.state"; readonly nodeId: string; readonly state: "idle" | "streaming" | "completed" | "failed" }
  | { readonly type: "agent.error"; readonly nodeId: string; readonly error: string };

/** workflow shell 内嵌 agent 子会话控制器。 */
export interface EmbeddedAgentSessionController {
  readonly nodeId: string;
  readonly sessionId: string;
  readonly runtimeHost: AgentSessionRuntime;
  readonly session: AgentSession;
  subscribe(listener: (event: EmbeddedAgentSessionEvent) => void): () => void;
  prompt(input: string): Promise<void>;
  dispose(): Promise<void>;
}

export interface CreateEmbeddedAgentSessionControllerOptions {
  readonly nodeId: string;
  readonly assembly: ResolvedPiAgentAssembly;
  readonly config?: WorkflowConfig;
  readonly runtime?: WorkflowRuntime;
  readonly host?: WorkflowPiHostCapabilities;
}

/** 为 workflow agent 子视图创建嵌入式会话控制器。 */
export async function createEmbeddedAgentSessionController(
  options: CreateEmbeddedAgentSessionControllerOptions,
): Promise<EmbeddedAgentSessionController> {
  const created = await createPiAgentSessionRuntime({
    assembly: options.assembly,
    config: options.config,
    runtime: options.runtime,
    host: options.host,
  });
  const session = created.runtimeHost.session;
  await session.bindExtensions({});

  return {
    nodeId: options.nodeId,
    sessionId: session.sessionId,
    runtimeHost: created.runtimeHost,
    session,
    subscribe(listener) {
      return session.subscribe((event) => {
        const mapped = mapSessionEvent(options.nodeId, event);
        if (mapped.length > 0) {
          for (const item of mapped) {
            listener(item);
          }
        }
      });
    },
    async prompt(input) {
      await session.prompt(input);
    },
    async dispose() {
      session.dispose();
      await created.runtimeHost.dispose();
    },
  };
}

function mapSessionEvent(
  nodeId: string,
  event: AgentSessionEvent,
): EmbeddedAgentSessionEvent[] {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent?.type === "text_delta") {
        return [{
          type: "agent.message",
          nodeId,
          role: "assistant",
          text: event.assistantMessageEvent.delta,
        }];
      }
      return [];
    case "tool_execution_start":
      return [
        {
          type: "agent.state",
          nodeId,
          state: "streaming",
        },
        {
          type: "agent.tool",
          nodeId,
          toolName: event.toolName,
          status: "start",
        },
      ];
    case "tool_execution_end":
      return [{
        type: "agent.tool",
        nodeId,
        toolName: event.toolName,
        status: "end",
      }];
    case "agent_end":
      return [{
        type: "agent.state",
        nodeId,
        state: event.willRetry ? "streaming" : "completed",
      }];
    default:
      return [];
  }
}
