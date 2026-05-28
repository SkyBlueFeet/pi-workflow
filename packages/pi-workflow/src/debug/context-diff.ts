/** 上下文变更的单个条目。 */
export interface ContextDiffEntry {
  readonly path: string;
  readonly type: "added" | "removed" | "changed";
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}

const MaxDepth = 5;
const MaxArrayLength = 10;
const MaxValueLength = 200;

/**
 * 计算两个上下文快照之间的差异。
 * 以 _ 开头的键将被忽略；递归深度上限为 5 层，避免栈溢出。
 *
 * @param before 之前快照
 * @param after 之后快照
 * @returns 差异条目列表
 */
export function computeContextDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ContextDiffEntry[] {
  const entries: ContextDiffEntry[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (key.startsWith("_")) continue;

    if (!(key in before)) {
      entries.push({
        path: key,
        type: "added",
        newValue: truncateValue(after[key]),
      });
    } else if (!(key in after)) {
      entries.push({
        path: key,
        type: "removed",
        oldValue: truncateValue(before[key]),
      });
    } else {
      deepDiff(key, before[key], after[key], entries, 0);
    }
  }

  return entries;
}

function deepDiff(
  path: string,
  before: unknown,
  after: unknown,
  entries: ContextDiffEntry[],
  depth: number,
): void {
  if (depth > MaxDepth) return;

  if (before === after) return;
  if (typeof before !== typeof after) {
    entries.push({ path, type: "changed", oldValue: truncateValue(before), newValue: truncateValue(after) });
    return;
  }

  if (before === null || after === null) {
    if (before !== after) {
      entries.push({ path, type: "changed", oldValue: truncateValue(before), newValue: truncateValue(after) });
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length || !arraysEqual(before, after)) {
      entries.push({ path, type: "changed", oldValue: truncateValue(before), newValue: truncateValue(after) });
    }
    return;
  }

  if (typeof before === "object" && typeof after === "object") {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const allSubKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const subKey of allSubKeys) {
      const subPath = `${path}.${subKey}`;
      if (!(subKey in beforeObj)) {
        entries.push({ path: subPath, type: "added", newValue: truncateValue(afterObj[subKey]) });
      } else if (!(subKey in afterObj)) {
        entries.push({ path: subPath, type: "removed", oldValue: truncateValue(beforeObj[subKey]) });
      } else {
        deepDiff(subPath, beforeObj[subKey], afterObj[subKey], entries, depth + 1);
      }
    }
    return;
  }

  if (before !== after) {
    entries.push({ path, type: "changed", oldValue: truncateValue(before), newValue: truncateValue(after) });
  }
}

function truncateValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > MaxValueLength ? value.slice(0, MaxValueLength) + "..." : value;
  }

  if (Array.isArray(value)) {
    return value.length > MaxArrayLength
      ? [...value.slice(0, MaxArrayLength), `...(${value.length - MaxArrayLength} more)`]
      : value;
  }

  if (typeof value === "object") {
    const str = JSON.stringify(value);
    if (str.length > MaxValueLength) {
      return str.slice(0, MaxValueLength) + "...";
    }
  }

  return value;
}

function arraysEqual(left: unknown[], right: unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
