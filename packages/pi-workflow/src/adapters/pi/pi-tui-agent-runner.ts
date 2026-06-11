import {
  AgentSessionRuntime,
  InteractiveMode,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentSessionRuntimeDiagnostic,
} from "@earendil-works/pi-coding-agent";
import type { WorkflowConfig } from "../../config/types.js";
import type { ResolvedPiAgentAssembly } from "../../agents/types.js";
import type { WorkflowRuntime } from "../../runtime/workflow-runtime.js";
import type { WorkflowPiHostCapabilities } from "./types.js";
import { createPiAgentSessionRuntime } from "./pi-agent-session-runtime.js";

/** `pi-tui` 运行请求，直接消费 resolved assembly。 */
export interface PiTuiAgentRunRequest {
  readonly assembly: ResolvedPiAgentAssembly;
  readonly config?: WorkflowConfig;
  readonly input?: Record<string, unknown>;
  readonly prompt?: string;
  readonly runtime?: WorkflowRuntime;
  readonly host?: WorkflowPiHostCapabilities;
}

/** `pi-tui` 运行结果。 */
export interface PiTuiAgentRunResult {
  readonly runtimeHost: AgentSessionRuntime;
  readonly diagnostics: readonly AgentSessionRuntimeDiagnostic[];
}

/** 用 `pi-coding-agent` interactive mode 运行一个已解析 agent。 */
export async function runResolvedAssemblyInPiTui(
  request: PiTuiAgentRunRequest,
): Promise<PiTuiAgentRunResult> {
  const initialMessage = normalizeInitialMessage(request.prompt);
  const created = await createPiAgentSessionRuntime({
    assembly: request.assembly,
    config: request.config,
    runtime: request.runtime,
    host: request.host,
  });
  const interactiveMode = new InteractiveMode(created.runtimeHost, {
    initialMessage,
  });
  await interactiveMode.run();

  return {
    runtimeHost: created.runtimeHost,
    diagnostics: created.runtimeHost.diagnostics,
  };
}

/**
 * 仅在调用方显式提供非空 prompt 时才注入启动消息，避免 run 默认进入界面时自动发送空输入。
 */
function normalizeInitialMessage(prompt: string | undefined): string | undefined {
  if (typeof prompt !== "string") {
    return undefined;
  }

  const normalized = prompt.trim();
  return normalized.length > 0 ? normalized : undefined;
}
