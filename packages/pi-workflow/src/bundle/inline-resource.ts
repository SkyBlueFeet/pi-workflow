import type { ResourceCollectResult } from "../resources/types.js";
import { readResourceFile } from "../resources/metadata.js";

export interface InlineResourceMap {
  readonly [path: string]: string;
}

export function buildInlineResourceMap(
  inlineResources: readonly ResourceCollectResult[],
): InlineResourceMap {
  const map: Record<string, string> = {};
  for (const r of inlineResources) {
    if (r.strategy !== "inline") continue;
    const { buffer } = readResourceFile(r.sourcePath);
    map[r.path] = buffer.toString("utf-8");
  }
  return map;
}

export function embedInlineResources(
  document: Record<string, unknown>,
  inlineMap: InlineResourceMap,
): Record<string, unknown> {
  if (Object.keys(inlineMap).length === 0) return document;
  return { ...document, _inlineResources: inlineMap };
}

export function extractInlineResources(
  docRaw: Record<string, unknown>,
): { document: Record<string, unknown>; inlineMap: InlineResourceMap } {
  const { _inlineResources, ...rest } = docRaw;
  return {
    document: rest,
    inlineMap: (_inlineResources as InlineResourceMap) ?? {},
  };
}
