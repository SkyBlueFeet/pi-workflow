import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext, StreamableNodeExecutor } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowPiHostCapabilities } from "../adapters/pi/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowConfig } from "../config/types.js";
import { resolveModelConfig, formatModelString } from "../config/resolver.js";
import { createRegistryFromConfig } from "../agents/registry.js";
import { resolveAgentConfig, resolveAgentModelSettings } from "../agents/resolver.js";
import { resolveWorkflowTools } from "../agents/workflow-tool-bridge.js";
import { adaptWorkflowTools } from "../agents/workflow-tool-adapter.js";
import { restrictSecurityConfig } from "../security/policy.js";
import { PiPermissionBridge } from "../adapters/pi/permission-bridge.js";
import { requestPermissionApproval } from "../security/permission-request.js";

/** Agent 节点输入结构 */
export interface AgentInput {
  /** 系统提示词 */
  system_prompt?: string;
  /** 用户提示词 */
  user_prompt?: string;
  /** 模型标识 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大输出 token 数 */
  max_tokens?: number;
}

/** Agent 节点执行器，通过 PI host 的 runAgent 能力执行 AI agent，支持流式输出事件 */
export class AgentExecutor implements WorkflowNodeExecutor, StreamableNodeExecutor {
  /**
   * 执行 agent 节点（非流式），聚合流式事件中的 delta 返回完整内容
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   */
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    let content = "";
    for await (const _event of this.executeStreaming(node, context)) {
      if (_event.type === "node.progress" && _event.delta) {
        content += _event.delta;
      }
    }
    return {
      output: content,
      artifacts: [
        {
          type: "agent",
          data: content,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        },
      ],
    };
  }

  /**
   * 流式执行 agent 节点，通过 PI host 的 runAgent API 与 AI 模型交互，yield 进度事件
   * @param node - 工作流节点 IR
   * @param context - 执行上下文
   * @yields node.progress 事件（文本增量、工具调用等）
   * @returns 包含完整输出内容和 artifact 的执行结果
   * @throws 当 context.host 不支持 runAgent 或工具解析失败时
   */
  async *executeStreaming(
    node: WorkflowNodeIR,
    context: ExecutionContext,
  ): AsyncGenerator<WorkflowRuntimeEvent, NodeExecutionResult> {
    const piHost = context.host as WorkflowPiHostCapabilities;
    if (!piHost.runAgent) {
      throw new Error(`agent 节点 ${node.id} 需要 PI host 能力，当前 host 不支持 runAgent`);
    }

    const config = context.config as WorkflowConfig | undefined;
    const input = context.nodeInput as Record<string, unknown>;
    const agentId = (node.executor?.config as Record<string, unknown>)?.["agentId"] as string | undefined;
    const permissionBridge = new PiPermissionBridge({
      piPermissionCheck: piHost.checkPermission?.bind(piHost),
    });

    let systemPrompt: string;
    let userPrompt: string;
    let resolvedTools: readonly import("../ir/types.js").WorkflowToolRefIR[] | undefined;
    let resolvedSkills: readonly import("../ir/types.js").WorkflowSkillRefIR[] | undefined;
    let resolvedMcp: readonly import("../ir/types.js").WorkflowMcpConfigIR[] | undefined;
    let hostCallableTools: import("../agents/types.js").HostCallableTool[] | undefined;
    let model: string | undefined;
    let temperature: number | undefined;
    let maxTokens: number | undefined;

    if (agentId && config) {
      const registry = createRegistryFromConfig(config);
      const resolved = resolveAgentConfig(node, config, registry);
      const resolvedModel = resolveAgentModelSettings(node, input, resolved);

      systemPrompt = (input["system_prompt"] as string)
        ?? (input["systemPrompt"] as string)
        ?? resolved.systemPrompt;
      userPrompt = (input["user_prompt"] as string)
        ?? (input["userPrompt"] as string)
        ?? (input["prompt"] as string)
        ?? JSON.stringify(input);

      model = resolvedModel.model;
      temperature = resolvedModel.temperature;
      maxTokens = resolvedModel.maxTokens;
      resolvedSkills = resolved.skills;
      resolvedTools = resolved.tools;
      resolvedMcp = resolved.mcp;
      const agentSecurity = restrictSecurityConfig(config?.security, resolved.permissions);

      const agentPermission = await permissionBridge.checkPermission("extension.execute", agentSecurity, {
        scope: { agentId: agentId ?? node.id },
        piCapabilityName: "extension.execute",
        piResourceName: agentId ?? node.id,
      });
      if (!agentPermission.allowed) {
        const approval = await requestPermissionApproval({
          runId: context.runId,
          nodeId: node.id,
          capability: "extension.execute",
          reason: agentPermission.reason,
          actorLabel: `智能体 ${agentId ?? node.id}`,
          resource: agentId ?? node.id,
          cwd: config?.baseDir,
          requestUserInput: piHost.requestUserInput?.bind(piHost),
        });
        if (!approval.granted) {
          throw new Error(`智能体 "${agentId}" 未获授权: ${agentPermission.reason}`);
        }
      }

      for (const mcpEntry of resolvedMcp) {
        const mcpPermission = await permissionBridge.checkPermission("mcp.use", agentSecurity, {
          scope: { server: mcpEntry.server },
          piCapabilityName: "mcp.use",
          piResourceName: mcpEntry.server,
        });
        if (!mcpPermission.allowed) {
          const approval = await requestPermissionApproval({
            runId: context.runId,
            nodeId: node.id,
            capability: "mcp.use",
            reason: mcpPermission.reason,
            actorLabel: `智能体 ${agentId ?? node.id} 的 MCP ${mcpEntry.server}`,
            resource: mcpEntry.server,
            cwd: config?.baseDir,
            requestUserInput: piHost.requestUserInput?.bind(piHost),
          });
          if (!approval.granted) {
            throw new Error(`智能体 "${agentId}" 的 MCP "${mcpEntry.server}" 未获授权: ${mcpPermission.reason}`);
          }
        }
      }

      if (Object.keys(resolved.workflowTools).length > 0 && context.runtime) {
        const bridgeResult = resolveWorkflowTools(resolved, config);
        if (bridgeResult.errors.length > 0) {
          const messages = bridgeResult.errors.map((error) => `${error.name}: ${error.message}`).join("; ");
          throw new Error(`工作流工具解析失败: ${messages}`);
        }
        if (bridgeResult.tools.length > 0) {
          const maxDepth = config?.executor?.maxWorkflowToolDepth ?? 10;
          hostCallableTools = adaptWorkflowTools(bridgeResult.tools, {
            runtime: context.runtime,
            config,
            parentRunId: context.runId,
            signal: context.signal,
            maxDepth,
            securityConfig: agentSecurity,
            host: piHost,
          });
        }
      }
    } else {
      systemPrompt = (input["system_prompt"] as string)
        ?? (input["systemPrompt"] as string)
        ?? "You are a helpful assistant.";
      userPrompt = (input["user_prompt"] as string)
        ?? (input["userPrompt"] as string)
        ?? (input["prompt"] as string)
        ?? JSON.stringify(input);
      model = (input["model"] as string) ?? formatModelString(resolveModelConfig(node, config));
      temperature = input["temperature"] as number | undefined;
      maxTokens = (input["max_tokens"] as number | undefined) ?? (input["maxTokens"] as number | undefined);
      resolvedSkills = node.capabilities?.skills;
      resolvedTools = node.capabilities?.tools;
      resolvedMcp = node.capabilities?.mcp;
    }

    const gen = piHost.runAgent({
      nodeId: node.id,
      systemPrompt,
      prompt: userPrompt,
      input: context.nodeInput,
      model,
      temperature,
      maxTokens,
      skills: resolvedSkills,
      tools: resolvedTools,
      mcp: resolvedMcp,
      signal: context.signal,
      toolExecutors: hostCallableTools,
    });

    let content = "";
    for await (const event of gen) {
      switch (event.type) {
        case "agent.text_delta":
          content += event.delta;
          yield {
            type: "node.progress",
            workflowRunId: context.runId,
            nodeId: node.id,
            message: event.delta,
            delta: event.delta,
          };
          break;
        case "agent.tool_start":
          yield {
            type: "node.progress",
            workflowRunId: context.runId,
            nodeId: node.id,
            message: `工具调用: ${event.toolName}`,
          };
          break;
        case "agent.tool_end":
          yield {
            type: "node.progress",
            workflowRunId: context.runId,
            nodeId: node.id,
            message: `工具完成: ${event.toolName}`,
          };
          break;
        case "agent.error":
          yield { type: "node.failed", workflowRunId: context.runId, nodeId: node.id, error: event.error };
          throw new Error(event.error);
      }
    }

    return {
      output: content,
      artifacts: [
        {
          type: "agent",
          data: content,
          targetPath: node.output?.to,
          mergeStrategy: node.output?.mergeStrategy ?? "replace",
        },
      ],
    };
  }
}
