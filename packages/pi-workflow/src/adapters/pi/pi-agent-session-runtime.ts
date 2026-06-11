import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentSessionRuntime,
  AgentSessionRuntimeDiagnostic,
  AgentSessionServices,
  CreateAgentSessionRuntimeFactory,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowConfig } from "../../config/types.js";
import type { ResolvedPiAgentAssembly } from "../../agents/types.js";
import type { WorkflowRuntime } from "../../runtime/workflow-runtime.js";
import { adaptWorkflowTools } from "../../agents/workflow-tool-adapter.js";
import type { WorkflowPiHostCapabilities } from "./types.js";

/** 可复用的 PI agent session runtime 创建请求。 */
export interface CreatePiAgentSessionRuntimeRequest {
  readonly assembly: ResolvedPiAgentAssembly;
  readonly config?: WorkflowConfig;
  readonly runtime?: WorkflowRuntime;
  readonly host?: WorkflowPiHostCapabilities;
}

/** 可复用的 PI agent session runtime 创建结果。 */
export interface CreatePiAgentSessionRuntimeResult {
  readonly runtimeHost: AgentSessionRuntime;
  readonly diagnostics: readonly AgentSessionRuntimeDiagnostic[];
  readonly services: AgentSessionServices;
}

/** 为 workflow 内嵌子视图或独立 pi-tui 运行面创建可复用 session/runtime。 */
export async function createPiAgentSessionRuntime(
  request: CreatePiAgentSessionRuntimeRequest,
): Promise<CreatePiAgentSessionRuntimeResult> {
  const cwd = request.config?.baseDir ?? process.cwd();
  const assembly = request.assembly;
  const customTools = await buildCustomTools(assembly, request.config, request.runtime, request.host);
  const tools = resolveAllowedToolNames(assembly, customTools);
  let lastServices: AgentSessionServices | undefined;

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, agentDir, sessionManager }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      resourceLoaderOptions: {
        noContextFiles: true,
        noPromptTemplates: true,
        noThemes: false,
        noExtensions: true,
        noSkills: true,
        systemPrompt: assembly.prompt.systemPrompt,
      },
    });

    lastServices = services;
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
      tools,
      customTools,
      model: resolvePiCodingAgentModel(services, assembly),
    });

    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    };
  };

  const runtimeHost = await createAgentSessionRuntime(createRuntime, {
    cwd,
    agentDir: cwd,
    sessionManager: SessionManager.inMemory(cwd),
  });

  if (!lastServices) {
    throw new Error(`创建 PI agent session runtime 失败: 未获得 services (${assembly.id})`);
  }

  return {
    runtimeHost,
    diagnostics: runtimeHost.diagnostics,
    services: lastServices,
  };
}

async function buildCustomTools(
  assembly: ResolvedPiAgentAssembly,
  config: WorkflowConfig | undefined,
  runtime: WorkflowRuntime | undefined,
  host: WorkflowPiHostCapabilities | undefined,
): Promise<ToolDefinition[]> {
  const customTools: ToolDefinition[] = [];

  if (runtime && assembly.workflowTools.length > 0) {
    const hostTools = adaptWorkflowTools([...assembly.workflowTools], {
      runtime,
      config,
      parentRunId: `pi-tui-${assembly.id}`,
      maxDepth: config?.executor?.maxWorkflowToolDepth ?? 10,
      host,
      securityConfig: config?.security,
    });

    for (const tool of hostTools) {
      customTools.push({
        name: tool.name,
        label: tool.name,
        description: tool.description ?? tool.name,
        parameters: Type.Object({}),
        execute: async (_toolCallId, params) => {
          const result = await tool.execute(params as Record<string, unknown>);
          return {
            content: [{ type: "text", text: result.content }],
            isError: result.isError,
            details: { isError: result.isError },
          };
        },
      });
    }
  }

  return customTools;
}

function resolveAllowedToolNames(
  assembly: ResolvedPiAgentAssembly,
  customTools: readonly ToolDefinition[],
): string[] {
  const names = new Set<string>();
  for (const ref of assembly.tools) {
    names.add(ref.name);
  }
  for (const tool of customTools) {
    names.add(tool.name);
  }
  return Array.from(names);
}

function resolvePiCodingAgentModel(
  services: AgentSessionServices,
  assembly: ResolvedPiAgentAssembly,
) {
  if (!assembly.model?.provider || !assembly.model?.name) {
    return undefined;
  }

  return services.modelRegistry.find(assembly.model.provider, assembly.model.name);
}
