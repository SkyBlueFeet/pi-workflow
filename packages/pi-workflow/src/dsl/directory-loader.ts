import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { WorkflowDslDocument, WorkflowDslNode, DslValue } from "./types.js";
import type { WorkflowDiagnostic } from "../ir/diagnostics.js";
import { loadFromObject } from "./loader.js";
import {
  buildDirectoryInheritanceContext,
  normalizeDirectoryDocument,
  type DirectoryInheritanceContext,
} from "./directory-normalizer.js";

/** 目录加载的结果：文档、诊断与已解析文件列表。 */
export interface DirectoryLoadResult {
  readonly document: WorkflowDslDocument;
  readonly diagnostics: readonly WorkflowDiagnostic[];
  readonly resolvedFiles: readonly string[];
}

/**
 * 从工作流目录加载 DSL 文档。
 * 读取 flow.json 及其引用的节点文件、子工作流，递归解析。
 *
 * @param workflowDir 工作流根目录路径
 * @returns 包含文档、诊断和已解析文件列表的结果对象
 */
export function loadFromDirectory(workflowDir: string): DirectoryLoadResult {
  const resolvedFiles: string[] = [];
  const allDiagnostics: WorkflowDiagnostic[] = [];

  const flowPath = resolve(workflowDir, "flow.json");
  if (!existsSync(flowPath)) {
    return {
      document: { id: "", version: "", title: "", entry: "", nodes: [] },
      diagnostics: [{ code: "DIR-001", severity: "error", message: `flow.json 不存在: ${flowPath}` }],
      resolvedFiles: [],
    };
  }

  return doLoad(workflowDir, flowPath, resolvedFiles, allDiagnostics);
}

function doLoad(
  workflowDir: string,
  flowPath: string,
  resolvedFiles: string[],
  diagnostics: WorkflowDiagnostic[],
  nodeIdPrefix?: string,
  inheritedContext?: DirectoryInheritanceContext,
): DirectoryLoadResult {
  const raw = readFileSync(flowPath, "utf-8");
  const parsed: Record<string, unknown> = JSON.parse(raw);
  resolvedFiles.push(flowPath);

  const nodeFiles = parsed["nodeFiles"] as string[] | undefined;
  if (nodeFiles && Array.isArray(nodeFiles)) {
    const externalNodes: WorkflowDslNode[] = [];
    for (const ref of nodeFiles) {
      const nodePath = resolve(workflowDir, ref);
      if (!existsSync(nodePath)) {
        diagnostics.push({ code: "DIR-002", severity: "error", message: `节点文件不存在: ${nodePath}` });
        continue;
      }

      const stat = statSync(nodePath);
      let nodeData: Record<string, unknown>;
      let nodeBaseDir: string;

      if (stat.isDirectory()) {
        const nodeJsonPath = resolve(nodePath, "node.json");
        if (!existsSync(nodeJsonPath)) {
          diagnostics.push({ code: "DIR-004", severity: "error", message: `节点目录缺少 node.json: ${nodePath}` });
          continue;
        }
        nodeData = JSON.parse(readFileSync(nodeJsonPath, "utf-8")) as Record<string, unknown>;
        nodeBaseDir = nodePath;
        resolvedFiles.push(nodeJsonPath);
      } else {
        nodeData = JSON.parse(readFileSync(nodePath, "utf-8")) as Record<string, unknown>;
        nodeBaseDir = dirname(nodePath);
        resolvedFiles.push(nodePath);
      }

      const node = nodeData as unknown as WorkflowDslNode;
      const resolvedNode = resolveNodePromptFile(node, nodeBaseDir, resolvedFiles, diagnostics);
      externalNodes.push(resolvedNode);
    }
    const existing = (parsed["nodes"] as unknown[]) ?? [];
    parsed["nodes"] = [...existing, ...externalNodes];
  }

  const currentContext = buildDirectoryInheritanceContext(parsed, inheritedContext);

  const rawNodes = parsed["nodes"] as Record<string, unknown>[] | undefined;
  if (rawNodes) {
    const resolved: unknown[] = [];
    for (const n of rawNodes) {
      const subDir = n["subWorkflowDir"] as string | undefined;
      if (subDir) {
        const subFlowDir = resolve(workflowDir, subDir);
        const subFlowPath = resolve(subFlowDir, "flow.json");
        if (!existsSync(subFlowPath)) {
          diagnostics.push({ code: "DIR-005", severity: "error", message: `子工作流 flow.json 不存在: ${subFlowPath}` });
          resolved.push(n);
          continue;
        }

        const subId = n["id"] as string;
        const subPrefix = `${subId}.`;
        const subResult = doLoad(subFlowDir, subFlowPath, resolvedFiles, diagnostics, subPrefix, currentContext);

        const subEntry = subResult.document.entry;
        const subNodes = subResult.document.nodes;
        const subEntryIds: string[] = [];
        if (subEntry && subNodes.some(sn => sn.id === subEntry)) {
          subEntryIds.push(subEntry);
        } else {
          const hasIncoming = new Set<string>();
          for (const sn of subNodes) {
            for (const d of sn.dependsOn ?? []) hasIncoming.add(d);
          }
          for (const sn of subNodes) {
            if (!hasIncoming.has(sn.id)) subEntryIds.push(sn.id);
          }
        }

        const subDependsOn = (n["dependsOn"] as string[]) ?? [];
        const resolvedSubNodes = subNodes.map(subNode => {
          const finalDependsOn = [...(subNode.dependsOn ?? [])];
          if (subEntryIds.includes(subNode.id)) {
            for (const sd of subDependsOn) {
              if (!finalDependsOn.includes(sd)) finalDependsOn.push(sd);
            }
          }
          return {
            ...subNode,
            dependsOn: [...new Set(finalDependsOn)],
          };
        });

        const { subWorkflowDir: _, ...parentNode } = n;
        const children = parentNode["children"] as string[] | undefined;
        parentNode["children"] = [...(children ?? []), ...subEntryIds];
        resolved.push(parentNode);
        resolved.push(...resolvedSubNodes);
      } else {
        resolved.push(n);
      }
    }
    parsed["nodes"] = resolved;
  }

  if (nodeIdPrefix) {
    const entry = parsed["entry"] as string | undefined;
    if (entry) {
      parsed["entry"] = `${nodeIdPrefix}${entry}`;
    }
    const nodes = parsed["nodes"] as Record<string, unknown>[] | undefined;
    if (nodes) {
      parsed["nodes"] = nodes.map(n => ({
        ...n,
        id: `${nodeIdPrefix}${n["id"] as string}`,
        dependsOn: ((n["dependsOn"] as string[]) ?? []).map(d => `${nodeIdPrefix}${d}`),
        children: ((n["children"] as string[]) ?? []).map(c => `${nodeIdPrefix}${c}`),
      }));
    }
  }

  const normalized = normalizeDirectoryDocument(parsed, workflowDir, diagnostics, currentContext);
  if ("$schema" in parsed) {
    normalized["$schema"] = parsed["$schema"];
  }
  const dslResult = loadFromObject(normalized);
  const document = resolveDocumentPromptFiles(dslResult.document, workflowDir, resolvedFiles, diagnostics);
  diagnostics.push(...dslResult.diagnostics.filter(d => !diagnostics.includes(d)));

  return { document, diagnostics: [...diagnostics], resolvedFiles };
}

function resolveNodePromptFile(
  node: WorkflowDslNode,
  baseDir: string,
  resolvedFiles: string[],
  diagnostics: WorkflowDiagnostic[],
): WorkflowDslNode {
  if (!node.executor?.promptFile) return node;

  const promptPath = resolve(baseDir, node.executor.promptFile);
  if (!existsSync(promptPath)) {
    diagnostics.push({
      code: "DIR-003",
      severity: "warning",
      message: `promptFile 不存在: ${promptPath} (节点 ${node.id})`,
      nodeId: node.id,
    });
    return node;
  }

  const promptContent = readFileSync(promptPath, "utf-8");
  resolvedFiles.push(promptPath);

  const inputs = { ...node.inputs } as Record<string, DslValue>;
  if (!inputs["system_prompt"]) {
    inputs["system_prompt"] = promptContent;
  }

  return { ...node, inputs };
}

function resolveDocumentPromptFiles(
  doc: WorkflowDslDocument,
  workflowDir: string,
  resolvedFiles: string[],
  diagnostics: WorkflowDiagnostic[],
): WorkflowDslDocument {
  const nodes = doc.nodes.map(node => {
    if (!node.executor?.promptFile) return node;
    if (node.inputs && (node.inputs as Record<string, unknown>)["system_prompt"]) return node;

    const promptPath = resolve(workflowDir, node.executor.promptFile);
    if (!existsSync(promptPath)) {
      diagnostics.push({
        code: "DIR-003",
        severity: "warning",
        message: `promptFile 不存在: ${promptPath} (节点 ${node.id})`,
        nodeId: node.id,
      });
      return node;
    }

    const promptContent = readFileSync(promptPath, "utf-8");
    resolvedFiles.push(promptPath);

    const inputs = { ...node.inputs } as Record<string, DslValue>;
    if (!inputs["system_prompt"]) {
      inputs["system_prompt"] = promptContent;
    }

    return { ...node, inputs };
  });

  return { ...doc, nodes };
}
