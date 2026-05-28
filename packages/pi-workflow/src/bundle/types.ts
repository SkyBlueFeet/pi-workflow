import type { WorkflowDslDocument } from "../dsl/types.js";

export interface WorkflowBundleManifest {
  readonly kind: "pi-workflow-bundle";
  readonly bundleVersion: "1";
  readonly workflow: {
    readonly id: string;
    readonly title?: string;
    readonly version?: string;
  };
  readonly source: {
    readonly type: "directory";
    readonly entry: "flow.json";
    readonly builtAt: string;
  };
  readonly document: {
    readonly path: "document.json";
    readonly sha256: string;
    readonly size: number;
  };
  readonly resources: readonly WorkflowBundleResourceEntry[];
  readonly configSnapshot: {
    readonly included: false;
  };
  readonly signature?: {
    readonly format?: string;
    readonly value?: string;
  };
}

export interface WorkflowBundleResourceEntry {
  readonly path: string;
  readonly sourcePath: string;
  readonly strategy: "inline" | "archive";
  readonly mediaType?: string;
  readonly encoding?: string;
  readonly size: number;
  readonly sha256: string;
  readonly usage: readonly string[];
}

export interface WorkflowBundleLoadResult {
  readonly manifest: WorkflowBundleManifest;
  readonly document: WorkflowDslDocument;
  readonly resourceReader: WorkflowBundleResourceReader;
}

export interface WorkflowBundleResourceReader {
  has(path: string): boolean;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  getMetadata(path: string): {
    mediaType?: string;
    size: number;
    sha256: string;
  };
}
