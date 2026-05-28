import type { WorkflowDslDocument } from "../dsl/types.js";
import type { ResourceDeclaration } from "../resources/types.js";

export function normalizeUsage(usage: string | readonly string[]): readonly string[] {
  if (typeof usage === "string") return usage ? [usage] : [];
  return usage ?? [];
}

export function collectDslReferencedResources(
  doc: WorkflowDslDocument,
  _workflowDir: string,
  resolvedFiles: readonly string[],
): ResourceDeclaration[] {
  const declarations: ResourceDeclaration[] = [];
  const seen = new Set<string>();

  for (const node of doc.nodes) {
    const promptFile = node.executor?.promptFile;
    if (promptFile && !seen.has(promptFile)) {
      seen.add(promptFile);
      declarations.push({
        path: promptFile,
        usage: `node:${node.id}:prompt_file`,
        strategy: "inline" as const,
      });
    }
  }

  const resolvedSet = new Set(resolvedFiles.map(f => f.replace(/\\/g, "/")));

  return declarations.filter(d => {
    const hasResolved = Array.from(resolvedSet).some(r => r.includes(d.path));
    if (hasResolved && !seen.has(`_resolved_${d.path}`)) {
      seen.add(`_resolved_${d.path}`);
      return true;
    }
    return hasResolved;
  });
}
