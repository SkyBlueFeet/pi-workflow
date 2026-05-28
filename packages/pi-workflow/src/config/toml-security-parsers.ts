import type { TomlLoadError } from "./toml-loader.js";
import type {
  WorkflowSecurityConfig, PermissionGrant, PermissionCapability,
  NodeSecurityConfig, SecurityDefaultMode, SecurityAuditConfig,
} from "../security/types.js";

/** 类型守卫：判断值是否为非 null 的对象。 */
function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

/** 解析 TOML security 段，验证 defaultMode、permissions 数组、nodes 及 audit 配置。 */
export function parseSecurityConfig(
  val: unknown,
  filePath?: string,
  errors?: TomlLoadError[],
): WorkflowSecurityConfig | undefined {
  if (!isRecord(val)) {
    errors?.push({ path: filePath ?? "", message: "security 必须是表类型" });
    return undefined;
  }

  let defaultMode: SecurityDefaultMode | undefined;
  let permissions: readonly PermissionGrant[] | undefined;
  const nodes: Record<string, NodeSecurityConfig> = {};
  let audit: SecurityAuditConfig | undefined;

  if (typeof val["defaultMode"] === "string") {
    if (val["defaultMode"] === "deny" || val["defaultMode"] === "allow-known-safe") {
      defaultMode = val["defaultMode"];
    } else {
      errors?.push({ path: filePath ?? "", message: `security.defaultMode 必须是 "deny" 或 "allow-known-safe"` });
    }
  }

  if (val["permissions"] != null) {
    if (!Array.isArray(val["permissions"])) {
      errors?.push({ path: filePath ?? "", message: "security.permissions 必须是数组" });
    } else {
      permissions = parsePermissionGrants(val["permissions"], filePath, errors);
    }
  }

  if (val["nodes"] != null) {
    if (!isRecord(val["nodes"])) {
      errors?.push({ path: filePath ?? "", message: "security.nodes 必须是表类型" });
    } else {
      for (const [nodeKey, nodeVal] of Object.entries(val["nodes"])) {
        if (!isRecord(nodeVal)) {
          errors?.push({ path: filePath ?? "", message: `security.nodes.${nodeKey} 必须是表类型` });
          continue;
        }
        if (nodeVal["permissions"] != null) {
          if (!Array.isArray(nodeVal["permissions"])) {
            errors?.push({ path: filePath ?? "", message: `security.nodes.${nodeKey}.permissions 必须是数组` });
          } else {
            nodes[nodeKey] = { permissions: parsePermissionGrants(nodeVal["permissions"], filePath, errors) };
          }
        }
      }
    }
  }

  if (val["audit"] != null) {
    if (!isRecord(val["audit"])) {
      errors?.push({ path: filePath ?? "", message: "security.audit 必须是表类型" });
    } else {
      const a = val["audit"] as Record<string, unknown>;
      audit = {
        enabled: typeof a["enabled"] === "boolean" ? a["enabled"] : undefined,
        includeAllowDecisions: typeof a["includeAllowDecisions"] === "boolean" ? a["includeAllowDecisions"] : undefined,
        includeDenyDecisions: typeof a["includeDenyDecisions"] === "boolean" ? a["includeDenyDecisions"] : undefined,
      };
    }
  }

  const hasNodes = Object.keys(nodes).length > 0;
  if (defaultMode === undefined && permissions === undefined && !hasNodes && audit === undefined) return undefined;

  return {
    ...(defaultMode !== undefined && { defaultMode }),
    ...(permissions !== undefined && { permissions }),
    ...(hasNodes && { nodes }),
    ...(audit !== undefined && { audit }),
  } as WorkflowSecurityConfig;
}

/** 解析 permissions 数组，每项需包含 capability 字段，可选的 scope 对象。 */
export function parsePermissionGrants(
  arr: unknown[],
  filePath?: string,
  errors?: TomlLoadError[],
): readonly PermissionGrant[] {
  const grants: PermissionGrant[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!isRecord(item)) {
      errors?.push({ path: filePath ?? "", message: `security.permissions[${i}] 必须是表类型` });
      continue;
    }
    if (typeof item["capability"] !== "string") {
      errors?.push({ path: filePath ?? "", message: `security.permissions[${i}] 缺少 capability 字段` });
      continue;
    }
    const cap = item["capability"] as PermissionCapability;
    if (item["scope"] != null) {
      if (!isRecord(item["scope"])) {
        errors?.push({ path: filePath ?? "", message: `security.permissions[${i}].scope 必须是表类型` });
        grants.push({ capability: cap });
      } else {
        grants.push({ capability: cap, scope: item["scope"] as Readonly<Record<string, unknown>> });
      }
    } else {
      grants.push({ capability: cap });
    }
  }
  return grants;
}
