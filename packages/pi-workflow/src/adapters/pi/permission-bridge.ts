import type {
  PermissionGrant,
  PermissionCapability,
  WorkflowSecurityConfig,
  PermissionCheckResult,
} from "../../security/types.js";
import { evaluateCapability } from "../../security/policy.js";

/** PI 侧权限检查的结果。 */
export interface PiPermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** 权限桥接器的构造选项，可传入 PI 侧的权限检查回调。 */
export interface PiPermissionBridgeOptions {
  readonly piPermissionCheck?: (capability: string, resource?: string) => PiPermissionResult | Promise<PiPermissionResult>;
}

/** 工作流安全策略与 PI 宿主策略之间的权限桥接器。 */
export class PiPermissionBridge {
  private piCheck?: (capability: string, resource?: string) => PiPermissionResult | Promise<PiPermissionResult>;

  constructor(options?: PiPermissionBridgeOptions) {
    this.piCheck = options?.piPermissionCheck;
  }

  /**
   * 逐级检查权限：先工作流策略，再 PI 宿主策略。
   * 任一级拒绝则返回拒绝结果。
   *
   * @param capability 权限能力
   * @param workflowConfig 工作流安全配置
   * @param options 可选的检查范围及 PI 侧名称
   * @returns 检查结果
   */
  async checkPermission(
    capability: PermissionCapability,
    workflowConfig: WorkflowSecurityConfig | undefined,
    options?: {
      scope?: Readonly<Record<string, unknown>>;
      piCapabilityName?: string;
      piResourceName?: string;
    },
  ): Promise<PermissionCheckResult> {
    const workflowResult = evaluateCapability(workflowConfig, capability, options?.scope);

    if (!workflowResult.allowed) {
      return { allowed: false, reason: `[workflow] ${workflowResult.reason}` };
    }

    if (this.piCheck && options?.piCapabilityName) {
      const piResult = await this.piCheck(options.piCapabilityName, options.piResourceName);
      if (!piResult.allowed) {
        return {
          allowed: false,
          reason: `[PI] ${piResult.reason ?? "PI 侧拒绝了该操作"}`,
        };
      }
    }

    return { allowed: true, reason: "workflow 策略和 PI 侧均允许" };
  }

  /**
   * 合并工作流与 PI 侧的授权列表：仅保留两方都允许的授权条目。
   *
   * @param workflowGrants 工作流侧授权列表
   * @param _piCapabilities PI 侧能力列表（当前仅用作回调过滤）
   * @returns 合并后的授权列表
   */
  async mergeWorfklowAndPiGrants(
    workflowGrants: readonly PermissionGrant[],
    _piCapabilities: readonly string[],
  ): Promise<readonly PermissionGrant[]> {
    if (!this.piCheck) return workflowGrants;

    const result: PermissionGrant[] = [];
    for (const grant of workflowGrants) {
      const piResult = await this.piCheck(grant.capability);
      if (piResult.allowed) {
        result.push(grant);
      }
    }

    return result;
  }
}
