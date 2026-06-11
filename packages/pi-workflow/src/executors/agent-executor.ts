import type { WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext, StreamableNodeExecutor } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";
import type { WorkflowPiHostCapabilities, WorkflowHostEvent } from "../adapters/pi/types.js";
import type { WorkflowRuntimeEvent } from "../events/types.js";
import type { WorkflowConfig } from "../config/types.js";
import { resolveModelConfig, formatModelString } from "../config/resolver.js";
import { createRegistryFromConfig } from "../agents/registry.js";
import { resolveAgentConfig } from "../agents/resolver.js";
import { resolveWorkflowTools } from "../agents/workflow-tool-bridge.js";
import { adaptWorkflowTools } from "../agents/workflow-tool-adapter.js";
import { CustomAgentInvoker } from "../agents/invoker.js";
import { restrictSecurityConfig } from "../security/policy.js";
import { PiPermissionBridge } from "../adapters/pi/permission-bridge.js";
import { requestPermissionApproval } from "../security/permission-request.js";
import type { HostCallableTool } from "../agents/types.js";

/** Agent 节点输入结构 */
export interface AgentInput {
  system_prompt?: string;
  user_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/** Agent 节点执行器，通过 PI host 的 runAgent 能力执行 AI agent，支持流式输出事件 */
export class AgentExecutor implements WorkflowNodeExecutor, StreamableNodeExecutor {
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

    const gen = agentId && config
      ? this.executeWithAgentId(node, context, piHost, config, input, agentId)
      : this.executeLegacy(node, context, piHost, config, input);

    return yield* gen;
  }

  private async *executeWithAgentId(
    node: WorkflowNodeIR,
    context: ExecutionContext,
    piHost: WorkflowPiHostCapabilities,
    config: WorkflowConfig,
    input: Record<string, unknown>,
    agentId: string,
  ): AsyncGenerator<WorkflowRuntimeEvent, NodeExecutionResult> {
    const registry = createRegistryFromConfig(config);
    const resolved = resolveAgentConfig(node, config, registry);
    const permissionBridge = new PiPermissionBridge({
      piPermissionCheck: piHost.checkPermission?.bind(piHost),
    });

    const agentSecurity = restrictSecurityConfig(config.security, resolved.permissions);

    const agentPermission = await permissionBridge.checkPermission("extension.execute", agentSecurity, {
      scope: { agentId },
      piCapabilityName: "extension.execute",
      piResourceName: agentId,
    });
    if (!agentPermission.allowed) {
      const approval = await requestPermissionApproval({
        runId: context.runId,
        nodeId: node.id,
        capability: "extension.execute",
        reason: agentPermission.reason,
        actorLabel: `智能体 ${agentId}`,
        resource: agentId,
        cwd: config.baseDir,
        requestUserInput: piHost.requestUserInput?.bind(piHost),
      });
      if (!approval.granted) {
        throw new Error(`智能体 "${agentId}" 未获授权: ${agentPermission.reason}`);
      }
    }

    for (const mcpEntry of resolved.mcp) {
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
          actorLabel: `智能体 ${agentId} 的 MCP ${mcpEntry.server}`,
          resource: mcpEntry.server,
          cwd: config.baseDir,
          requestUserInput: piHost.requestUserInput?.bind(piHost),
        });
        if (!approval.granted) {
          throw new Error(`智能体 "${agentId}" 的 MCP "${mcpEntry.server}" 未获授权: ${mcpPermission.reason}`);
        }
      }
    }

    let hostCallableTools: HostCallableTool[] | undefined;
    if (resolved.workflowTools.length > 0 && context.runtime) {
      const bridgeResult = resolveWorkflowTools(resolved, config);
      if (bridgeResult.errors.length > 0) {
        const messages = bridgeResult.errors.map((error) => `${error.name}: ${error.message}`).join("; ");
        throw new Error(`工作流工具解析失败: ${messages}`);
      }
      if (bridgeResult.tools.length > 0) {
        const maxDepth = config.executor?.maxWorkflowToolDepth ?? 10;
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

    const prompt = (input["user_prompt"] as string)
      ?? (input["userPrompt"] as string)
      ?? (input["prompt"] as string)
      ?? JSON.stringify(input);

    const systemPrompt = (input["system_prompt"] as string)
      ?? (input["systemPrompt"] as string)
      ?? resolved.prompt.systemPrompt;

    const model = (input["model"] as string) ?? resolved.model?.id;
    const temperature = input["temperature"] as number | undefined ?? resolved.model?.temperature;
    const maxTokens = (input["max_tokens"] as number | undefined)
      ?? (input["maxTokens"] as number | undefined)
      ?? resolved.model?.maxTokens;

    const invoker = new CustomAgentInvoker({ host: piHost, registry, config });
    const gen = invoker.invoke({
      agentId,
      prompt,
      input: context.nodeInput,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      skills: resolved.skills.length > 0 ? resolved.skills : undefined,
      tools: resolved.tools.length > 0 ? resolved.tools : undefined,
      mcp: resolved.mcp.length > 0 ? resolved.mcp : undefined,
      toolExecutors: hostCallableTools,
      signal: context.signal,
      resolvedAssembly: resolved,
    });

    return yield* this.streamHostEvents(node, context, gen);
  }

  private async *executeLegacy(
    node: WorkflowNodeIR,
    context: ExecutionContext,
    piHost: WorkflowPiHostCapabilities,
    config: WorkflowConfig | undefined,
    input: Record<string, unknown>,
  ): AsyncGenerator<WorkflowRuntimeEvent, NodeExecutionResult> {
    const systemPrompt = (input["system_prompt"] as string)
      ?? (input["systemPrompt"] as string)
      ?? "You are a helpful assistant.";
    const userPrompt = (input["user_prompt"] as string)
      ?? (input["userPrompt"] as string)
      ?? (input["prompt"] as string)
      ?? JSON.stringify(input);
    const model = (input["model"] as string) ?? formatModelString(resolveModelConfig(node, config));
    const temperature = input["temperature"] as number | undefined;
    const maxTokens = (input["max_tokens"] as number | undefined) ?? (input["maxTokens"] as number | undefined);

    const gen = piHost.runAgent({
      nodeId: node.id,
      systemPrompt,
      prompt: userPrompt,
      input: context.nodeInput,
      model,
      temperature,
      maxTokens,
      skills: node.capabilities?.skills,
      tools: node.capabilities?.tools,
      mcp: node.capabilities?.mcp,
      signal: context.signal,
    });

    return yield* this.streamHostEvents(node, context, gen);
  }

  private async *streamHostEvents(
    node: WorkflowNodeIR,
    context: ExecutionContext,
    gen: AsyncGenerator<WorkflowHostEvent, unknown>,
  ): AsyncGenerator<WorkflowRuntimeEvent, NodeExecutionResult> {
    let content = "";
    for await (const event of gen) {
      switch (event.type) {
        case "agent.text_delta":
          content += event.delta;
          yield {
            type: "agent.message.delta",
            workflowRunId: context.runId,
            nodeId: node.id,
            delta: event.delta,
          };
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
            type: "agent.tool.started",
            workflowRunId: context.runId,
            nodeId: node.id,
            toolName: event.toolName,
          };
          yield {
            type: "node.progress",
            workflowRunId: context.runId,
            nodeId: node.id,
            message: `工具调用: ${event.toolName}`,
          };
          break;
        case "agent.tool_end":
          yield {
            type: "agent.tool.completed",
            workflowRunId: context.runId,
            nodeId: node.id,
            toolName: event.toolName,
          };
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
