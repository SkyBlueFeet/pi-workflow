import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const MEDIA_TYPE_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".csv": "text/csv",
  ".toml": "application/toml",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".css": "text/css",
  ".sh": "application/x-sh",
  ".bat": "application/x-msdos-program",
  ".ps1": "application/x-powershell",
};

export interface ResourceMetadata {
  readonly size: number;
  readonly sha256: string;
  readonly mediaType?: string;
  readonly encoding?: string;
  readonly isText: boolean;
}

export function computeResourceMetadata(filePath: string, buffer: Buffer): ResourceMetadata {
  const size = buffer.length;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const ext = extname(filePath).toLowerCase();
  const mediaType = MEDIA_TYPE_MAP[ext] ?? "application/octet-stream";

  const isText = isLikelyText(buffer, ext);
  const encoding = isText ? "utf-8" : undefined;

  return { size, sha256, mediaType, encoding, isText };
}

export function readResourceFile(filePath: string): { buffer: Buffer; text: string | null } {
  const buffer = readFileSync(filePath);
  try {
    const text = buffer.toString("utf-8");
    if (isValidUtf8(buffer)) {
      return { buffer, text };
    }
  } catch {
    // ignore
  }
  return { buffer, text: null };
}

function isLikelyText(buffer: Buffer, ext: string): boolean {
  const textExtensions = new Set([
    ".md", ".txt", ".json", ".xml", ".yaml", ".yml",
    ".html", ".htm", ".csv", ".toml", ".js", ".ts",
    ".css", ".sh", ".bat", ".ps1", ".env", ".gitignore",
    ".mdx", ".mjs", ".cjs", ".mts", ".cts",
  ]);
  if (textExtensions.has(ext)) return true;
  return isValidUtf8(buffer);
}

function isValidUtf8(buffer: Buffer): boolean {
  let i = 0;
  while (i < buffer.length) {
    if ((buffer[i] & 0x80) === 0) {
      i += 1;
    } else if ((buffer[i] & 0xe0) === 0xc0) {
      if (i + 1 >= buffer.length || (buffer[i + 1] & 0xc0) !== 0x80) return false;
      i += 2;
    } else if ((buffer[i] & 0xf0) === 0xe0) {
      if (i + 2 >= buffer.length || (buffer[i + 1] & 0xc0) !== 0x80 || (buffer[i + 2] & 0xc0) !== 0x80) return false;
      i += 3;
    } else if ((buffer[i] & 0xf8) === 0xf0) {
      if (i + 3 >= buffer.length || (buffer[i + 1] & 0xc0) !== 0x80 || (buffer[i + 2] & 0xc0) !== 0x80 || (buffer[i + 3] & 0xc0) !== 0x80) return false;
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}
