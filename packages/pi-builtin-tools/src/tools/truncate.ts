export interface TruncationResult {
  content: string;
  truncated: boolean;
  nextOffset: number | undefined;
  readBytes: number;
  totalBytes: number;
}

const DEFAULT_LIMIT = 4000;
const OVERFLOW_MARGIN = 200;

export function truncateContent(
  text: string,
  offset: number,
  limit: number | undefined,
): TruncationResult {
  const effectiveLimit = limit ?? DEFAULT_LIMIT;
  if (offset >= text.length) {
    return { content: "", truncated: false, nextOffset: undefined, readBytes: 0, totalBytes: text.length };
  }

  const end = Math.min(offset + effectiveLimit + OVERFLOW_MARGIN, text.length);
  let content = text.slice(offset, end);
  let truncated = end < text.length;

  if (truncated) {
    const exactEnd = offset + effectiveLimit;
    content = text.slice(offset, exactEnd);
    truncated = true;
  }

  return {
    content,
    truncated,
    nextOffset: truncated ? offset + effectiveLimit : undefined,
    readBytes: content.length,
    totalBytes: text.length,
  };
}

export function buildTruncationNotice(result: TruncationResult, _filePath: string): string | undefined {
  if (!result.truncated) return undefined;
  return `文件较大（共 ${result.totalBytes} 字符），已返回 ${result.readBytes} 字符。使用 offset=${result.nextOffset}&limit=${result.readBytes} 继续读取。`;
}
