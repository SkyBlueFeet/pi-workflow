import type {
  WorkflowSecurityConfig,
  ResolvedSecurityContext,
  PermissionGrant,
  ActorType,
  NodeSecurityConfig,
} from "./types.js";
import { intersectGrants, mergeGrants } from "./permissions.js";
import { defaultSecurityConfig } from "./policy.js";

/** 解析安全上下文的选项，包含运行 ID、执行者类型、配置、节点 ID 及父上下文。 */
export interface ResolveSecurityContextOptions {
  readonly runId: string;
  readonly actorType: ActorType;
  readonly config?: WorkflowSecurityConfig;
  readonly nodeId?: string;
  readonly parentContext?: ResolvedSecurityContext;
}

/**
 * 解析运行时的安全上下文：从配置中获取权限列表，叠加节点级限制。
 * 有父上下文时，取父子权限的交集。
 *
 * @param options 解析选项
 * @returns 解析后的安全上下文
 */
export function resolveSecurityContext(
  options: ResolveSecurityContextOptions,
): ResolvedSecurityContext {
  const { runId, actorType, config, nodeId, parentContext } = options;

  const effectiveConfig = config ?? defaultSecurityConfig();
  let grants: readonly PermissionGrant[] = effectiveConfig.permissions ?? [];

  if (nodeId && effectiveConfig.nodes?.[nodeId]) {
    const nodeSec: NodeSecurityConfig = effectiveConfig.nodes[nodeId];
    if (nodeSec.permissions) {
      grants = intersectGrants(grants, nodeSec.permissions);
    }
  }

  if (parentContext) {
    grants = intersectGrants(parentContext.grants, grants);
  }

  return {
    runId,
    actorType,
    grants,
    inheritedFrom: parentContext?.runId,
  };
}

/**
 * 在已有上下文中叠加节点级安全限制，取权限交集。
 * 节点未声明权限时返回原上下文不变。
 *
 * @param nodeId 节点 ID
 * @param context 当前安全上下文
 * @param nodeSecurity 节点安全配置
 * @returns 限制后的安全上下文
 */
export function resolveNodeSecurity(
  nodeId: string,
  context: ResolvedSecurityContext,
  nodeSecurity?: NodeSecurityConfig,
): ResolvedSecurityContext {
  if (!nodeSecurity?.permissions) return context;

  return {
    ...context,
    grants: intersectGrants(context.grants, nodeSecurity.permissions),
  };
}

/**
 * 在上下文中叠加智能体级权限，仅取交集。
 * 无智能体权限时返回原上下文。
 */
export function resolveAgentSecurity(
  context: ResolvedSecurityContext,
  agentPermissions?: readonly PermissionGrant[],
): ResolvedSecurityContext {
  if (!agentPermissions) return context;

  return {
    ...context,
    actorType: "agent",
    grants: intersectGrants(context.grants, agentPermissions),
  };
}

/**
 * 解析子工作流的安全上下文：合并子级权限后再与父级取交集，
 * 确保子工作流无法超出父级权限范围。
 */
export function resolveSubWorkflowSecurity(
  parentContext: ResolvedSecurityContext,
  childConfig?: WorkflowSecurityConfig,
): ResolvedSecurityContext {
  const childGrants = childConfig?.permissions ?? [];
  const merged = mergeGrants(parentContext.grants, childGrants);
  const intersected = intersectGrants(parentContext.grants, merged);

  return {
    runId: parentContext.runId,
    actorType: "workflow",
    grants: intersected,
    inheritedFrom: parentContext.runId,
  };
}
