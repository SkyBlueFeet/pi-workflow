import type { WorkflowInteractionRequest, WorkflowInteractionResult } from "../adapters/pi/types.js";
import type { PermissionCapability } from "./types.js";
import { CAPABILITY_LABELS } from "./permissions.js";
import {
  grantRunScopedApproval,
  hasPersistentApproval,
  hasRunScopedApproval,
  persistApproval,
} from "./approval-store.js";

interface RequestPermissionApprovalOptions {
  readonly runId?: string;
  readonly nodeId: string;
  readonly capability: PermissionCapability;
  readonly reason: string;
  readonly actorLabel: string;
  readonly resource?: string;
  readonly cwd?: string;
  readonly requestUserInput?: (request: WorkflowInteractionRequest) => Promise<WorkflowInteractionResult>;
}

/** 授权申请结果：包含是否允许及来源，供调用方决定审计与提示信息。 */
export interface PermissionApprovalResult {
  readonly granted: boolean;
  readonly mode: "deny" | "allow-once" | "allow-run" | "allow-persist" | "preapproved-run" | "preapproved-persist";
}

/**
 * 当权限被拒绝时，请求宿主通过 ask_user 风格交互向用户申请一次性授权。
 * 未配置 requestUserInput、用户拒绝或返回不可识别结果时，统一视为未授权。
 */
export async function requestPermissionApproval(
  options: RequestPermissionApprovalOptions,
): Promise<PermissionApprovalResult> {
  if (hasRunScopedApproval(options.runId, options.capability, options.resource)) {
    return { granted: true, mode: "preapproved-run" };
  }

  if (hasPersistentApproval(options.capability, options.resource, options.cwd)) {
    return { granted: true, mode: "preapproved-persist" };
  }

  if (!options.requestUserInput) {
    return { granted: false, mode: "deny" };
  }

  const capabilityLabel = CAPABILITY_LABELS[options.capability] ?? options.capability;
  const result = await options.requestUserInput({
    nodeId: options.nodeId,
    interactionId: `${options.nodeId}/permission/${options.capability}`,
    question: `${options.actorLabel} 需要申请 ${capabilityLabel} 权限。原因：${options.reason}。是否允许本次继续执行？`,
    expectedFormat: "choice",
    options: ["允许一次", "允许本次运行", "永久允许", "拒绝"],
    required: true,
  });

  const mode = resolveApprovalMode(result.input);
  if (mode === "allow-run" && options.runId) {
    grantRunScopedApproval(options.runId, options.capability, options.resource);
  }
  if (mode === "allow-persist") {
    persistApproval(options.capability, options.resource, options.cwd);
  }

  return {
    granted: mode !== "deny",
    mode,
  };
}

function resolveApprovalMode(input: Readonly<Record<string, unknown>>): PermissionApprovalResult["mode"] {
  const approved = input["approved"];
  if (typeof approved === "boolean") {
    return approved ? "allow-once" : "deny";
  }

  const answer = input["answer"];
  if (typeof answer === "string") {
    return mapAnswerToMode(answer);
  }

  const choice = input["choice"];
  if (typeof choice === "string") {
    return mapAnswerToMode(choice);
  }

  const selected = input["selected"];
  if (typeof selected === "string") {
    return mapAnswerToMode(selected);
  }

  return "deny";
}

function mapAnswerToMode(value: string): PermissionApprovalResult["mode"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "允许一次" || normalized === "allow" || normalized === "allow_once" || normalized === "yes" || normalized === "y" || normalized === "true") {
    return "allow-once";
  }
  if (normalized === "允许本次运行" || normalized === "allow_run" || normalized === "run") {
    return "allow-run";
  }
  if (normalized === "永久允许" || normalized === "allow_persist" || normalized === "persist" || normalized === "always") {
    return "allow-persist";
  }
  return "deny";
}
