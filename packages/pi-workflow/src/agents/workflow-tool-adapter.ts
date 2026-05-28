import type { WorkflowRuntime } from "../runtime/workflow-runtime.js";
import type { WorkflowConfig } from "../config/types.js";
import type { ResolvedWorkflowTool } from "./workflow-tool-bridge.js";
import type { HostCallableTool } from "./types.js";
import { evaluateCapability, restrictSecurityConfig } from "../security/policy.js";
import { requestPermissionApproval } from "../security/permission-request.js";
import type { WorkflowPiHostCapabilities } from "../adapters/pi/types.js";

/** 工作流工具适配器的运行选项。 */
export interface WorkflowToolAdapterOptions {
  readonly runtime: WorkflowRuntime;
  readonly config?: WorkflowConfig;
  readonly parentRunId: string;
  readonly signal?: AbortSignal;
  readonly maxDepth: number;
  readonly securityConfig?: WorkflowConfig["security"];
  readonly host?: WorkflowPiHostCapabilities;
}

/**
 * 将已解析的工作流工具适配为宿主可调用的 HostCallableTool 接口。
 *
 * @param tool 已解析的工作流工具
 * @param options 运行时选项
 * @returns 宿主可直接调用的工具实例
 */
export function adaptWorkflowTool(
  tool: ResolvedWorkflowTool,
  options: WorkflowToolAdapterOptions,
): HostCallableTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (params: Record<string, unknown>) => {
      return executeWorkflowTool(tool, params, options);
    },
  };
}

async function executeWorkflowTool(
  tool: ResolvedWorkflowTool,
  params: Record<string, unknown>,
  options: WorkflowToolAdapterOptions,
): Promise<{ content: string; isError: boolean }> {
  if (options.signal?.aborted) {
    return { content: "取消: 父运行已终止", isError: true };
  }

  const securityConfig = restrictSecurityConfig(options.securityConfig ?? options.config?.security, tool.permissions);
  const permission = evaluateCapability(securityConfig, "workflow.invoke", { tool: tool.name });
  if (!permission.allowed) {
    const approval = await requestPermissionApproval({
      runId: options.parentRunId,
      nodeId: tool.name,
      capability: "workflow.invoke",
      reason: permission.reason,
      actorLabel: `工作流工具 ${tool.name}`,
      resource: tool.name,
      cwd: options.config?.baseDir,
      requestUserInput: options.host?.requestUserInput,
    });
    if (!approval.granted) {
      return { content: `工作流工具 "${tool.name}" 未获授权: ${permission.reason}`, isError: true };
    }
  }

  try {
    const result = await options.runtime.runSubWorkflow(
      tool.workflow,
      params,
      {
        config: {
          ...options.config,
          security: securityConfig,
        },
        parentRunId: options.parentRunId,
        signal: options.signal,
        maxDepth: options.maxDepth,
      },
    );

    const output = result.finalOutput;
    const content = typeof output === "string"
      ? output
      : JSON.stringify(output ?? {}, null, 2);

    return { content, isError: false };
  } catch (err) {
    return { content: `工作流工具 "${tool.name}" 执行失败: ${String(err)}`, isError: true };
  }
}

/**
 * 批量将工作流工具适配为宿主可调用接口。
 *
 * @param tools 已解析的工作流工具列表
 * @param options 运行时选项
 * @returns 宿主可调用工具列表
 */
export function adaptWorkflowTools(
  tools: ResolvedWorkflowTool[],
  options: WorkflowToolAdapterOptions,
): HostCallableTool[] {
  return tools.map((tool) => adaptWorkflowTool(tool, options));
}
