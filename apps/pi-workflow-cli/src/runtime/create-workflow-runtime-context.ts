import { FileWorkflowRunStore, WorkflowRuntime, loadWorkflowConfigFile } from "@pi-workflow/core";
import type { WorkflowConfig, WorkflowDefinitionIR, WorkflowHostCapabilities } from "@pi-workflow/core";
import { createWorkflowExecutorRegistry } from "./create-workflow-executor-registry.js";
import { createWorkflowHost } from "./create-workflow-host.js";
import { resolveCliWorkflowDefaultModel } from "../env.js";

export interface CreateWorkflowRuntimeContextOptions {
  readonly ir: WorkflowDefinitionIR;
  readonly configPath?: string;
  readonly isMock: boolean;
  readonly scanExtensions: boolean;
  readonly yolo: boolean;
  readonly debug: boolean;
  readonly onDebug?: (message: string, ...args: readonly unknown[]) => void;
}

export interface WorkflowRuntimeContextMetadata {
  readonly isMock: boolean;
  readonly scannedExtensions: boolean;
  readonly registeredToolCount: number;
  readonly mode: "mock" | "live";
}

export interface WorkflowRuntimeContext {
  readonly runtime: WorkflowRuntime;
  readonly store: FileWorkflowRunStore;
  readonly host?: WorkflowHostCapabilities;
  readonly executorRegistry: ReturnType<typeof createWorkflowExecutorRegistry>;
  readonly config?: WorkflowConfig;
  readonly metadata: WorkflowRuntimeContextMetadata;
}

/** 统一创建 workflow CLI 的 runtime/store/host/registry/config 上下文。 */
export async function createWorkflowRuntimeContext(
  options: CreateWorkflowRuntimeContextOptions,
): Promise<WorkflowRuntimeContext> {
  const config = loadWorkflowConfig(options.configPath, options.onDebug);
  const hostResult = await createWorkflowHost({
    hasAgentNode: options.ir.nodes.some((node) => node.kind === "agent"),
    hasToolNode: options.ir.nodes.some((node) => node.kind === "tool"),
    isMock: options.isMock,
    scanExtensions: options.scanExtensions,
    debug: options.debug,
    config,
    yolo: options.yolo,
    onDebug: options.onDebug,
  });
  const store = new FileWorkflowRunStore();
  const executorRegistry = createWorkflowExecutorRegistry();
  const runtime = new WorkflowRuntime({
    executorRegistry,
    host: hostResult.host,
    store,
  });

  return {
    runtime,
    store,
    host: hostResult.host,
    executorRegistry,
    config: hostResult.config,
    metadata: {
      isMock: hostResult.metadata.isMock,
      scannedExtensions: hostResult.metadata.scannedExtensions,
      registeredToolCount: hostResult.metadata.registeredToolCount,
      mode: hostResult.metadata.isMock ? "mock" : "live",
    },
  };
}

function loadWorkflowConfig(
  configPath: string | undefined,
  onDebug?: (message: string, ...args: readonly unknown[]) => void,
): WorkflowConfig | undefined {
  const envDefaultModel = resolveCliWorkflowDefaultModel();
  const envConfig = envDefaultModel ? toWorkflowModelConfig(envDefaultModel) : undefined;

  if (!configPath) {
    return envConfig;
  }

  const loaded = loadWorkflowConfigFile(configPath);
  const config = {
    ...loaded.config,
    model: loaded.config.model ?? envConfig?.model,
    baseDir: loaded.baseDir,
  };
  onDebug?.("加载配置文件:", configPath, JSON.stringify(config, null, 2));
  return config;
}

function toWorkflowModelConfig(modelId: string): WorkflowConfig | undefined {
  const [provider, model] = modelId.split("/");
  if (!provider || !model) {
    return undefined;
  }

  return {
    model: {
      provider,
      model,
    },
  };
}
