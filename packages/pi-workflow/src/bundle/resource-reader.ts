import type { WorkflowBundleResourceReader, WorkflowBundleResourceEntry } from "./types.js";

export class BundleResourceReader implements WorkflowBundleResourceReader {
  private readonly entries: Map<string, { data: Buffer; meta: WorkflowBundleResourceEntry }>;

  constructor(entries: Map<string, { data: Buffer; meta: WorkflowBundleResourceEntry }>) {
    this.entries = entries;
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  readText(path: string): string {
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`资源不存在: ${path}`);
    return entry.data.toString("utf-8");
  }

  readBytes(path: string): Uint8Array {
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`资源不存在: ${path}`);
    return new Uint8Array(entry.data);
  }

  getMetadata(path: string): { mediaType?: string; size: number; sha256: string } {
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`资源不存在: ${path}`);
    return {
      mediaType: entry.meta.mediaType,
      size: entry.meta.size,
      sha256: entry.meta.sha256,
    };
  }

  get allEntries(): Map<string, { data: Buffer; meta: WorkflowBundleResourceEntry }> {
    return this.entries;
  }
}
