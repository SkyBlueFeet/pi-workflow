import { ALL_CAPABILITIES, MockPiHostAdapter, PiHostAdapter, evaluateCapability } from "@pi-workflow/core";
import type {
  HostCallableToolRecord,
  PermissionCapability,
  WorkflowConfig,
  WorkflowHostCapabilities,
  WorkflowSecurityConfig,
} from "@pi-workflow/core";

export interface CreateWorkflowHostOptions {
  readonly hasAgentNode: boolean;
  readonly hasToolNode: boolean;
  readonly isMock: boolean;
  readonly scanExtensions: boolean;
  readonly debug: boolean;
  readonly config?: WorkflowConfig;
  readonly yolo: boolean;
  readonly onDebug?: (message: string, ...args: readonly unknown[]) => void;
}

export interface WorkflowHostMetadata {
  readonly isMock: boolean;
  readonly scannedExtensions: boolean;
  readonly registeredToolCount: number;
}

const YOLO_SECURITY_CONFIG: WorkflowSecurityConfig = {
  permissions: ALL_CAPABILITIES.map((capability) => ({ capability })),
};

/** 统一创建 workflow CLI 使用的宿主能力，保证 run 与 resume 对 agent/tool 拥有同一能力集合。 */
export async function createWorkflowHost(
  options: CreateWorkflowHostOptions,
): Promise<{ host?: WorkflowHostCapabilities; metadata: WorkflowHostMetadata; config?: WorkflowConfig }> {
  const hasHostRequirement = options.hasAgentNode || options.hasToolNode;
  const config = options.yolo
    ? {
      ...options.config,
      security: {
        ...options.config?.security,
        ...YOLO_SECURITY_CONFIG,
      },
    }
    : options.config;

  if (!hasHostRequirement) {
    return {
      host: undefined,
      config,
      metadata: {
        isMock: options.isMock,
        scannedExtensions: false,
        registeredToolCount: 0,
      },
    };
  }

  if (options.isMock) {
    options.onDebug?.("使用 Mock PI Host");
    return {
      host: new MockPiHostAdapter(),
      config,
      metadata: {
        isMock: true,
        scannedExtensions: false,
        registeredToolCount: 0,
      },
    };
  }

  let nativeTools: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }> = [];
  let extensionTools: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    execute: (params: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  }> = [];
  let builtinTools: HostCallableToolRecord[] = [];

  try {
    const { PiExtensionBridge } = await import("@pi-workflow/extension-loader");
    const bridge = new PiExtensionBridge();
    nativeTools = bridge.getNativeTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    }));

    if (options.scanExtensions) {
      const results = await bridge.loadFromNodeModules();
      extensionTools = bridge.getAllTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      }));
      if (options.debug) {
        for (const result of results) {
          if (result.error) {
            options.onDebug?.(`扩展 ${result.packageName}: 跳过 (${result.error})`);
            continue;
          }
          options.onDebug?.(`扩展 ${result.packageName}: 加载 ${result.tools.length} 个工具`);
        }
      }
    }
  } catch (error) {
    options.onDebug?.("桥接层不可用:", error instanceof Error ? error.message : error);
  }

  try {
    const { registerBuiltinTools } = await import("@pi-workflow/builtin-tools");
    builtinTools = registerBuiltinTools();
  } catch (error) {
    options.onDebug?.("内置工具注册不可用:", error instanceof Error ? error.message : error);
  }

  const host = new PiHostAdapter({
    nativeTools,
    extensionTools,
    builtinTools,
    permissionCheck: (capability, resource) => {
      const result = evaluateCapability(
        config?.security,
        capability as PermissionCapability,
        resource ? { resource } : undefined,
      );
      return { allowed: result.allowed, reason: result.reason };
    },
  });
  const registeredToolCount = nativeTools.length + extensionTools.length + builtinTools.length;
  options.onDebug?.(`使用真实 PI Host${registeredToolCount ? ` (${registeredToolCount} 个宿主工具)` : ""}`);

  return {
    host,
    config,
    metadata: {
      isMock: false,
      scannedExtensions: options.scanExtensions,
      registeredToolCount,
    },
  };
}
