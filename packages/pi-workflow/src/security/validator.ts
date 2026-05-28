import type {
  WorkflowSecurityConfig,
  PermissionGrant,
  PermissionCapability,
  NodeSecurityConfig,
} from "./types.js";
import { evaluateCapability } from "./policy.js";

/** 安全校验单条错误，指明出错的节点、字段及描述。 */
export interface SecurityValidationError {
  readonly nodeId: string;
  readonly field: string;
  readonly message: string;
}

/** 安全配置校验结果，包含错误和警告两类信息。 */
export interface SecurityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SecurityValidationError[];
  readonly warnings: readonly SecurityValidationError[];
}

/**
 * 校验工作流安全配置：权限类型是否合法、defaultMode 取值是否有效。
 * 配置完全缺失时仅产生警告而非错误。
 *
 * @param config 安全配置（可选）
 * @returns 校验结果，含错误与警告
 */
export function validateSecurityConfig(
  config?: WorkflowSecurityConfig,
): SecurityValidationResult {
  const errors: SecurityValidationError[] = [];
  const warnings: SecurityValidationError[] = [];

  if (!config) {
    warnings.push({
      nodeId: "config",
      field: "security",
      message: "未配置安全策略，高风险能力默认拒绝。建议显式声明 security.permissions",
    });
    return { valid: true, errors, warnings };
  }

  const mode = config.defaultMode ?? "deny";

  if (config.permissions) {
    for (let i = 0; i < config.permissions.length; i++) {
      const perm = config.permissions[i];
      validatePermission(perm, `security.permissions[${i}]`, errors);
    }
  }

  if (mode === "allow-known-safe" && (!config.permissions || config.permissions.length === 0)) {
    warnings.push({
      nodeId: "config",
      field: "security.defaultMode",
      message: "defaultMode 为 'allow-known-safe' 但未声明任何权限，高风险能力仍将被拒绝",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validatePermission(
  perm: PermissionGrant,
  field: string,
  errors: SecurityValidationError[],
): void {
  const validCapabilities = new Set<PermissionCapability>([
    "fs.read", "fs.write", "network.request",
    "process.execute", "mcp.use", "extension.execute", "workflow.invoke",
  ]);
  if (!validCapabilities.has(perm.capability)) {
    errors.push({
      nodeId: "config",
      field,
      message: `未知权限类型: "${perm.capability}"`,
    });
  }

  if (perm.scope != null && typeof perm.scope !== "object") {
    errors.push({
      nodeId: "config",
      field: `${field}.scope`,
      message: "scope 必须是对象类型",
    });
  }
}

/**
 * 校验节点级权限是否在父级安全配置范围内（防越权）。
 * 节点未声明权限时直接放行。
 *
 * @param nodeId 节点 ID
 * @param kind 节点类型
 * @param nodeSecurity 节点安全配置
 * @param parentConfig 父级工作流安全配置
 * @returns 校验结果
 */
export function validateNodeSecurityPermissions(
  nodeId: string,
  kind: string,
  nodeSecurity: NodeSecurityConfig | undefined,
  parentConfig: WorkflowSecurityConfig | undefined,
): SecurityValidationResult {
  const errors: SecurityValidationError[] = [];
  const warnings: SecurityValidationError[] = [];

  if (!nodeSecurity?.permissions || nodeSecurity.permissions.length === 0) return { valid: true, errors, warnings };

  for (const perm of nodeSecurity.permissions) {
    if (!parentConfig?.permissions || parentConfig.permissions.length === 0) {
      errors.push({
        nodeId,
        field: `security.nodes.${nodeId}.permissions`,
        message: `节点 "${nodeId}" 声明了权限 "${perm.capability}"，但父级 workflow 未声明任何权限，构成越权`,
      });
      continue;
    }

    const allowed = evaluateCapability(parentConfig, perm.capability, perm.scope);
    if (!allowed.allowed) {
      errors.push({
        nodeId,
        field: `security.nodes.${nodeId}.permissions`,
        message: `节点 "${nodeId}" 尝试声明超出父级范围的权限 "${perm.capability}"，请先在父级 security.permissions 中添加`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 检查高风险节点类型（http / tool / agent）是否已获得对应权限授权。
 * 未配置 permissions 或授权不足时记录错误。
 *
 * @param nodeId 节点 ID
 * @param kind 节点类型，用于映射所需权限
 * @param config 安全配置
 * @returns 校验结果
 */
export function checkHighRiskNodeHasPermission(
  nodeId: string,
  kind: string,
  config: WorkflowSecurityConfig | undefined,
): SecurityValidationResult {
  const errors: SecurityValidationError[] = [];

  const capabilityMap: Record<string, PermissionCapability> = {
    "http": "network.request",
    "tool": "process.execute",
    "agent": "extension.execute",
  };

  const required = capabilityMap[kind];
  if (!required) return { valid: true, errors, warnings: [] };

  if (!config?.permissions || config.permissions.length === 0) {
    errors.push({
      nodeId,
      field: "security.permissions",
      message: `高风险节点 "${nodeId}" (${kind}) 需要权限 "${required}"，但 security.permissions 未配置`,
    });
    return { valid: false, errors, warnings: [] };
  }

  const allowed = evaluateCapability(config, required);
  if (!allowed.allowed) {
    errors.push({
      nodeId,
      field: "security.permissions",
      message: `高风险节点 "${nodeId}" (${kind}) 需要权限 "${required}"，但未在 security.permissions 中授权`,
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
