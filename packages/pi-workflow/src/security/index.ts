export type {
  PermissionCapability,
  PermissionGrant,
  WorkflowSecurityConfig,
  NodeSecurityConfig,
  SecurityAuditConfig,
  SecurityDefaultMode,
  ActorType,
  ResolvedSecurityContext,
  SecurityDecisionEvent,
  PermissionCheckResult,
} from "./types.js";

export {
  HIGH_RISK_CAPABILITIES,
  MEDIUM_RISK_CAPABILITIES,
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  isHighRisk,
  isKnownSafe,
  grantMatches,
  findGrant,
  mergeGrants,
  intersectGrants,
} from "./permissions.js";

export {
  evaluateCapability,
  mergePolicies,
  defaultSecurityConfig,
  restrictSecurityConfig,
  isCapabilityAllowed,
} from "./policy.js";
export type { PolicyDecision } from "./policy.js";

export { requestPermissionApproval } from "./permission-request.js";
export type { PermissionApprovalResult } from "./permission-request.js";

export {
  buildApprovalResource,
  hasRunScopedApproval,
  grantRunScopedApproval,
  clearRunScopedApprovals,
  hasPersistentApproval,
  persistApproval,
} from "./approval-store.js";

export {
  resolveSecurityContext,
  resolveNodeSecurity,
  resolveAgentSecurity,
  resolveSubWorkflowSecurity,
} from "./resolver.js";
export type { ResolveSecurityContextOptions } from "./resolver.js";

export {
  validateSecurityConfig,
  validateNodeSecurityPermissions,
  checkHighRiskNodeHasPermission,
} from "./validator.js";
export type { SecurityValidationError, SecurityValidationResult } from "./validator.js";

export { SecurityAuditor } from "./auditor.js";
