export type {
  ValueRef,
  WorkflowNodeKind,
  WorkflowExecutorIR,
  WorkflowOutputBindingIR,
  WorkflowControlIR,
  WorkflowNodeIR,
  WorkflowEdgeIR,
  WorkflowDefinitionIR,
} from "./types.js";

export type { WorkflowDiagnostic } from "./diagnostics.js";
export { WorkflowDiagnosticError } from "./diagnostics.js";

export { normalizeIr } from "./normalize.js";
export { topologicalSort } from "./graph.js";
