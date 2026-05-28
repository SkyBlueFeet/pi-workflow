import { createHash } from "node:crypto";
import type { WorkflowBundleManifest, WorkflowDiagnostic } from "@pi-workflow/core";
import { createZip } from "@pi-workflow/core";

export interface BuildFromDocumentResult {
  readonly manifest: WorkflowBundleManifest;
  readonly pwbData: Buffer;
  readonly diagnostics: readonly WorkflowDiagnostic[];
}

export function buildPwbFromDocument(
  doc: Record<string, unknown>,
  _debug?: boolean,
): BuildFromDocumentResult {
  const diagnostics: WorkflowDiagnostic[] = [];

  const docJson = JSON.stringify(doc, null, 2);
  const docBuf = Buffer.from(docJson, "utf-8");
  const docSha256 = createHash("sha256").update(docBuf).digest("hex");

  const manifest: WorkflowBundleManifest = {
    kind: "pi-workflow-bundle",
    bundleVersion: "1",
    workflow: {
      id: (doc["id"] as string) ?? "unknown",
      title: doc["title"] as string | undefined,
      version: doc["version"] as string | undefined,
    },
    source: {
      type: "directory",
      entry: "flow.json",
      builtAt: new Date().toISOString(),
    },
    document: {
      path: "document.json",
      sha256: docSha256,
      size: docBuf.length,
    },
    resources: [],
    configSnapshot: { included: false },
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const zipFiles = new Map<string, Buffer>();
  zipFiles.set("manifest.json", Buffer.from(manifestJson, "utf-8"));
  zipFiles.set("document.json", docBuf);

  const pwbData = createZip(zipFiles);

  return { manifest, pwbData, diagnostics };
}
