import type { WorkflowDefinitionIR, WorkflowNodeIR } from "../ir/types.js";
import type { WorkflowConfig, ConfigValidationResult, ConfigValidationError } from "./types.js";
import { resolveModelConfig, isModelConfigured } from "./resolver.js";
import { resolveDeclaredPackages } from "./package-resolver.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateSecurityConfig, checkHighRiskNodeHasPermission } from "../security/validator.js";
import type { ValueRef } from "../ir/types.js";
import { restrictSecurityConfig, evaluateCapability } from "../security/policy.js";
import type { PermissionCapability, PermissionGrant } from "../security/types.js";

/**
 * 对工作流 IR 进行全量配置校验，包括包安装、智能体引用、工作流工具路径及安全策略。
 * 收集所有错误后一并返回，不中途抛出。
 *
 * @param ir 工作流定义 IR
 * @param config 工作流配置（可选）
 * @param cwd 路径解析基准目录
 * @returns 校验结果，包含所有发现的错误
 */
export function validateWorkflowConfig(
  ir: WorkflowDefinitionIR,
  config?: WorkflowConfig,
  cwd?: string,
): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];

  const resolvedCwd = cwd ?? config?.baseDir;

  if (config?.packages) {
    validatePackages(config, errors, resolvedCwd);
  }

  const agentIds = new Set(Object.keys(config?.agents ?? {}));

  for (const node of ir.nodes) {
    if (node.kind === "agent") {
      validateAgentNode(node, ir, config, errors, agentIds);
    }
  }

  if (config?.workflowTools) {
    validateWorkflowTools(config.workflowTools, "workflowTools", errors, resolvedCwd);
  }

  validateSelfReferencingWorkflowTools(ir, config, errors);

  for (const [agentId, agent] of Object.entries(config?.agents ?? {})) {
    validateScopedPermissions(
      `agents.${agentId}`,
      agent.permissions,
      config?.security,
      errors,
      `智能体 "${agentId}"`,
    );

    if (agent.workflowTools) {
      validateWorkflowTools(agent.workflowTools, `agents.${agentId}.workflowTools`, errors, resolvedCwd);
    }

    if (agent.mcp && agent.mcp.length > 0) {
      validateCapabilityAccess(
        `agents.${agentId}`,
        config?.security,
        agent.permissions,
        "mcp.use",
        errors,
        `智能体 "${agentId}" 使用 MCP 需要权限 "mcp.use"`,
      );
    }

    if (agent.workflowTools && Object.keys(agent.workflowTools).length > 0) {
      validateCapabilityAccess(
        `agents.${agentId}`,
        config?.security,
        agent.permissions,
        "workflow.invoke",
        errors,
        `智能体 "${agentId}" 使用 workflowTools 需要权限 "workflow.invoke"`,
      );
    }

    for (const [toolName, tool] of Object.entries(agent.workflowTools ?? {})) {
      validateScopedPermissions(
        `agents.${agentId}.workflowTools.${toolName}`,
        tool.permissions,
        restrictSecurityConfig(config?.security, agent.permissions),
        errors,
        `智能体 "${agentId}" 的工作流工具 "${toolName}"`,
      );
    }
  }

  for (const [toolName, tool] of Object.entries(config?.workflowTools ?? {})) {
    validateScopedPermissions(
      `workflowTools.${toolName}`,
      tool.permissions,
      config?.security,
      errors,
      `工作流工具 "${toolName}"`,
    );
  }

  if (config?.security !== undefined) {
    validateWorkflowSecurity(config, ir, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** 校验安全配置：调用 security/validator 检查权限声明，并验证节点级权限不越权。 */
function validateWorkflowSecurity(
  config: WorkflowConfig,
  ir: WorkflowDefinitionIR,
  errors: ConfigValidationError[],
): void {
  const secResult = validateSecurityConfig(config.security);
  for (const err of secResult.errors) {
    errors.push({
      nodeId: err.nodeId,
      field: err.field,
      message: err.message,
    });
  }

  for (const node of ir.nodes) {
    const result = checkHighRiskNodeHasPermission(node.id, node.kind, config.security);
    for (const err of result.errors) {
      errors.push({
        nodeId: err.nodeId,
        field: err.field,
        message: err.message,
      });
    }
  }

  if (config.security?.nodes) {
    for (const [nodeId, nodeSec] of Object.entries(config.security.nodes)) {
      const irNode = ir.nodes.find(n => n.id === nodeId);
      if (!irNode) {
        errors.push({
          nodeId: "config",
          field: `security.nodes.${nodeId}`,
          message: `安全策略引用了 IR 中不存在的节点 "${nodeId}"`,
        });
        continue;
      }
      if (nodeSec.permissions && nodeSec.permissions.length > 0) {
        for (const perm of nodeSec.permissions) {
          const parentPerms = config.security?.permissions ?? [];
          if (parentPerms.length === 0) {
            errors.push({
              nodeId,
              field: `security.nodes.${nodeId}.permissions`,
              message: `节点 "${nodeId}" 声明了权限 "${perm.capability}"，但父级 workflow 未声明任何权限，构成越权`,
            });
          } else if (!parentPerms.some(p => p.capability === perm.capability)) {
            errors.push({
              nodeId,
              field: `security.nodes.${nodeId}.permissions`,
              message: `节点 "${nodeId}" 尝试声明超出父级范围的权限 "${perm.capability}"`,
            });
          }
        }
      }
    }
  }
}

/** 校验包配置：通过 package-resolver 检查每个包是否已安装及 manifest 是否可加载。 */
function validatePackages(
  config: WorkflowConfig,
  errors: ConfigValidationError[],
  cwd?: string,
): void {
  const resolved = resolveDeclaredPackages(config, cwd);
  for (const pkg of resolved) {
    if (!pkg.installed) {
      errors.push({
        nodeId: "config",
        field: `packages.${pkg.declaration.alias}`,
        message: pkg.error ?? `包 "${pkg.declaration.alias}" 未安装`,
      });
    }
    if (pkg.error && pkg.installed) {
      errors.push({
        nodeId: "config",
        field: `packages.${pkg.declaration.alias}`,
        message: pkg.error,
      });
    }
  }
}

/** 校验 agent 节点：检查引用的 agentId 是否存在、模型配置是否完整。 */
function validateAgentNode(
  node: WorkflowNodeIR,
  ir: WorkflowDefinitionIR,
  config?: WorkflowConfig,
  errors: ConfigValidationError[] = [],
  agentIds?: Set<string>,
): void {
  const agentId = (node.executor?.config as Record<string, unknown>)?.["agentId"] as string | undefined;

  if (agentId) {
    if (!agentIds?.has(agentId)) {
      errors.push({
        nodeId: node.id,
        field: "executor.config.agentId",
        message: `agent 节点 "${node.id}" 引用了不存在的智能体 "${agentId}"。请在 WorkflowConfig.agents 中定义`,
      });
    }
  }

  const modelConfig = resolveModelConfig(node, config);
  const agentModel = agentId ? config?.agents?.[agentId]?.model : undefined;
  const effectiveModel = {
    ...modelConfig,
    ...agentModel,
  };

  const modelBinding = node.inputBindings?.["model"] as ValueRef | undefined;
  const hasInputModel = modelBinding?.from === "literal"
    && typeof (modelBinding as { value: unknown }).value === "string"
    && validateModelString((modelBinding as { value: string }).value);

  if (!isModelConfigured(effectiveModel) && !hasInputModel) {
    errors.push({
      nodeId: node.id,
      field: "model",
      message: `agent 节点 "${node.id}" 未配置模型：请在节点 inputs.model 中指定，或在 WorkflowConfig 中设置默认模型（如 provider: "openai", model: "gpt-4o-mini"）`,
    });
  }
}

/** 校验工作流工具中是否存在静态自引用（inline IR 的 id 与父工作流 id 相同）。 */
function validateSelfReferencingWorkflowTools(
  ir: WorkflowDefinitionIR,
  config?: WorkflowConfig,
  errors: ConfigValidationError[] = [],
): void {
  const checkTools = (tools: Record<string, { workflow?: WorkflowDefinitionIR }>, source: string) => {
    for (const [name, def] of Object.entries(tools)) {
      if (def.workflow && def.workflow.id === ir.id) {
        errors.push({
          nodeId: "config",
          field: `${source}.${name}.workflow`,
          message: `工作流工具 "${name}" 的 inline IR id ("${def.workflow.id}") 与父工作流 id ("${ir.id}") 相同，构成显式静态自引用`,
        });
      }
    }
  };

  if (config?.workflowTools) {
    checkTools(config.workflowTools, "workflowTools");
  }

  if (config?.agents) {
    for (const [agentId, agent] of Object.entries(config.agents)) {
      if (agent.workflowTools) {
        checkTools(agent.workflowTools, `agents.${agentId}.workflowTools`);
      }
    }
  }
}

/** 校验工作流工具配置：检查 workflowPath 是否存在、是否至少指定了一项定义。 */
function validateWorkflowTools(
  workflowTools: NonNullable<WorkflowConfig["workflowTools"]>,
  fieldPrefix: string,
  errors: ConfigValidationError[],
  cwd?: string,
): void {
  for (const [name, def] of Object.entries(workflowTools)) {
    if (def.workflowPath) {
      const absPath = resolve(cwd ?? process.cwd(), def.workflowPath);
      if (!existsSync(absPath)) {
        errors.push({
          nodeId: "config",
          field: `${fieldPrefix}.${name}.workflowPath`,
          message: `工作流工具 "${name}" 的路径不存在: ${def.workflowPath}`,
        });
      }
    }

    if (!def.workflowPath && !def.workflow) {
      errors.push({
        nodeId: "config",
        field: `${fieldPrefix}.${name}`,
        message: `工作流工具 "${name}" 必须指定 workflowPath 或 workflow 定义`,
      });
    }
  }
}

/** 校验 agent / workflow tool 的局部权限不会超出 workflow 上界。 */
function validateScopedPermissions(
  fieldPrefix: string,
  permissions: readonly PermissionGrant[] | undefined,
  parentSecurity: WorkflowConfig["security"],
  errors: ConfigValidationError[],
  subject: string,
): void {
  if (!permissions || permissions.length === 0) {
    return;
  }

  const effectiveSecurity = restrictSecurityConfig(parentSecurity, permissions);
  for (const permission of permissions) {
    const result = evaluateCapability(effectiveSecurity, permission.capability, permission.scope);
    if (result.allowed) {
      continue;
    }

    errors.push({
      nodeId: "config",
      field: `${fieldPrefix}.permissions`,
      message: `${subject} 尝试声明超出父级范围的权限 "${permission.capability}"`,
    });
  }
}

/** 校验某类高风险能力在 workflow 与局部权限收敛后仍然可用。 */
function validateCapabilityAccess(
  fieldPrefix: string,
  workflowSecurity: WorkflowConfig["security"],
  scopedPermissions: readonly PermissionGrant[] | undefined,
  capability: PermissionCapability,
  errors: ConfigValidationError[],
  message: string,
): void {
  const effectiveSecurity = restrictSecurityConfig(workflowSecurity, scopedPermissions);
  const result = evaluateCapability(effectiveSecurity, capability);
  if (result.allowed) {
    return;
  }

  errors.push({
    nodeId: "config",
    field: `${fieldPrefix}.permissions`,
    message,
  });
}

/** 校验模型字符串是否为 `provider/model` 格式，两部分均非空。 */
export function validateModelString(modelString: string): boolean {
  const parts = modelString.split("/");
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}
