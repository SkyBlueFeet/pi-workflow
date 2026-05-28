import type { WorkflowNodeIR } from "../ir/types.js";
import type { ExtractorSourceType, ExtractorMode } from "../ir/types.js";
import type { WorkflowNodeExecutor, ExecutionContext } from "./types.js";
import type { NodeExecutionResult } from "../artifacts/types.js";

const DEFAULT_MAX_INPUT_CHARS = 20000;

interface ExtractorMeta {
  sourceType: ExtractorSourceType;
  mode: ExtractorMode;
  confidence?: number;
  warnings?: string[];
}

interface ExtractorSuccess {
  data: unknown;
  summary?: string;
  meta: ExtractorMeta;
}

interface ExtractorError {
  errorCode: "invalid_input" | "parse_failed" | "schema_mismatch" | "unsupported_source_type" | "unsupported_mode" | "model_refused";
  message: string;
  details?: Record<string, unknown>;
}

class ExtractorConfigError extends Error {}

export class ExtractorExecutor implements WorkflowNodeExecutor {
  async execute(node: WorkflowNodeIR, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = node.executor?.config ?? {};

    const sourceType = (config["sourceType"] as ExtractorSourceType) ?? "text";
    const mode = (config["mode"] as ExtractorMode) ?? "extract";
    const sourcePath = config["sourcePath"] as string | undefined;
    const fields = config["fields"] as readonly string[] | undefined;
    const schema = config["schema"] as Readonly<Record<string, unknown>> | undefined;
    const schemaRequired = (config["schemaRequired"] as boolean | undefined) ?? false;
    const maxInputChars = (config["maxInputChars"] as number) ?? DEFAULT_MAX_INPUT_CHARS;

    const warnings: string[] = [];

    const rawSource = this.resolveSource(context.nodeInput, sourcePath);
    if (rawSource == null || rawSource === "") {
      return this.errorResult("invalid_input", "输入源为空", node, { sourceType, mode });
    }

    let sourceStr: string;
    if (typeof rawSource === "string") {
      sourceStr = rawSource;
    } else if (typeof rawSource === "object") {
      sourceStr = JSON.stringify(rawSource);
    } else {
      sourceStr = String(rawSource);
    }

    if (sourceStr.length > maxInputChars) {
      sourceStr = sourceStr.slice(0, maxInputChars);
      warnings.push(`输入超长，已截断至 ${maxInputChars} 字符`);
    }

    let result: ExtractorSuccess;

    try {
      switch (mode) {
        case "extract":
          result = this.executeExtract(sourceStr, sourceType, fields, warnings);
          break;
        case "summarize":
          result = this.executeSummarize(sourceStr, sourceType, config, warnings);
          break;
        case "typed-object":
          result = this.executeTypedObject(sourceStr, sourceType, schema, schemaRequired, warnings);
          break;
        default:
          return this.errorResult("unsupported_mode", `不支持的处理模式: ${mode}`, node, { sourceType, mode });
      }
    } catch (err) {
      if (err instanceof ExtractorConfigError) {
        return this.errorResult("invalid_input", err.message, node, { sourceType, mode });
      }
      return this.errorResult("parse_failed", (err as Error).message, node, { sourceType, mode });
    }

    return {
      output: result,
      artifacts: [{
        type: "extractor",
        data: result,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }

  private resolveSource(
    nodeInput: Readonly<Record<string, unknown>>,
    sourcePath?: string,
  ): unknown {
    if (sourcePath) {
      return this.getDeepValue(nodeInput, sourcePath);
    }
    return nodeInput["input"] ?? nodeInput["content"] ?? nodeInput["text"] ?? null;
  }

  private getDeepValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private preprocessSource(raw: string, sourceType: ExtractorSourceType): {
    clean: string;
    meta: Record<string, unknown>;
  } {
    switch (sourceType) {
      case "text":
        return { clean: raw, meta: {} };
      case "html": {
        const titleMatch = raw.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";
        const withoutTags = raw
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
        const headings: string[] = [];
        const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h\1>/gi;
        let headingMatch: RegExpExecArray | null;
        while ((headingMatch = headingRegex.exec(raw)) !== null) {
          headings.push(headingMatch[2].trim());
        }
        const textContent = withoutTags
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          clean: textContent,
          meta: { title, headings },
        };
      }
      case "code": {
        const lines = raw.split("\n");
        const lineCount = lines.length;
        const symbolHints: { functions: string[]; classes: string[]; exports: string[] } = {
          functions: [],
          classes: [],
          exports: [],
        };
        for (const line of lines) {
          const trimmed = line.trim();
          const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
          if (fnMatch) symbolHints.functions.push(fnMatch[1]);
          const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
          if (classMatch) symbolHints.classes.push(classMatch[1]);
          const exportMatch = trimmed.match(/^(?:export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+))/);
          if (exportMatch && !trimmed.startsWith("export function") && !trimmed.startsWith("export class")) {
            symbolHints.exports.push(exportMatch[1]);
          }
          const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
          if (arrowMatch) symbolHints.functions.push(arrowMatch[1]);
          const reExport = trimmed.match(/^export\s+\{\s*(\w+)/);
          if (reExport) symbolHints.exports.push(reExport[1]);
        }
        const ext = this.guessLanguage(raw);
        return {
          clean: raw,
          meta: { languageHint: ext, lineCount, symbolHints },
        };
      }
      case "json": {
        let parsed: unknown;
        if (typeof raw === "string") {
          try {
            parsed = JSON.parse(raw);
          } catch {
            throw new Error("JSON 解析失败");
          }
        } else {
          parsed = raw;
        }
        return { clean: JSON.stringify(parsed, null, 2), meta: { parsed } };
      }
      default:
        return { clean: raw, meta: {} };
    }
  }

  private guessLanguage(code: string): string {
    if (/import\s+|export\s+|interface\s+|type\s+|const\s+\w+\s*:\s*/.test(code)) return "typescript";
    if (/require\(|module\.exports/.test(code)) return "javascript";
    if (/def\s+\w+\s*\(|import\s+\w+\s+from/.test(code)) return "python";
    if (/fn\s+\w+|fn\s+\(|->\s*[\w<>]/.test(code)) return "rust";
    if (/func\s+\w+|package\s+\w+/.test(code)) return "go";
    return "unknown";
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/[。！？.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  private extractKeywords(text: string, max = 10): string[] {
    const words = text.split(/[\s,，。．、；：()（）【】\[\]{}]+/).filter(w => w.length > 1);
    const freq = new Map<string, number>();
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been",
      "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
      "may", "might", "this", "that", "these", "those", "with", "from", "for", "and",
      "but", "or", "not", "no", "of", "in", "on", "at", "to", "by", "as", "it", "its",
      "我们", "他们", "它们", "这个", "那个", "这些", "那些", "的", "了", "在",
      "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上",
      "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看",
      "好", "自己", "这", "他", "她", "它", "们"]);
    for (const word of words) {
      const lower = word.toLowerCase();
      if (stopWords.has(lower) || /^\d+$/.test(word)) continue;
      freq.set(lower, (freq.get(lower) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([word]) => word);
  }

  private executeExtract(
    raw: string,
    sourceType: ExtractorSourceType,
    fields: readonly string[] | undefined,
    warnings: string[],
  ): ExtractorSuccess {
    const { clean, meta } = this.preprocessSource(raw, sourceType);
    let data: unknown;

    if (sourceType === "json" && meta["parsed"]) {
      const parsed = meta["parsed"] as Record<string, unknown>;
      if (fields && fields.length > 0) {
        data = {} as Record<string, unknown>;
        for (const field of fields) {
          (data as Record<string, unknown>)[field] = this.getDeepValue(parsed, field);
        }
      } else {
        data = parsed;
      }
    } else if (fields && fields.length > 0) {
      data = {} as Record<string, unknown>;
      for (const field of fields) {
        (data as Record<string, unknown>)[field] = this.extractField(clean, field);
      }
    } else {
      data = { content: clean };
      warnings.push("未提供 fields，返回全文内容");
    }

    return { data, meta: { sourceType, mode: "extract", warnings: warnings.length > 0 ? warnings : undefined } };
  }

  private extractField(text: string, field: string): string {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`"${escaped}"\\s*[:：]\\s*"([^"]+)"`, "i"),
      new RegExp(`"${escaped}"\\s*[:：]\\s*([^,\\n}]+)`, "i"),
      new RegExp(`${escaped}\\s*[:：]\\s*(.+?)(?:[,;，；]|$)`, "i"),
    ];
    for (const regex of patterns) {
      const m = regex.exec(text);
      if (m) return m[1].trim();
    }
    const lines = text.split("\n");
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes(field.toLowerCase())) {
        const match = line.match(/[:：]\s*(.+)/);
        if (match) return match[1].trim();
      }
    }
    return "";
  }

  private executeSummarize(
    raw: string,
    sourceType: ExtractorSourceType,
    config: Readonly<Record<string, unknown>>,
    warnings: string[],
  ): ExtractorSuccess {
    const { clean, meta: preMeta } = this.preprocessSource(raw, sourceType);
    const summaryStyle = (config["summaryStyle"] as string) ?? "brief";

    const sentences = this.splitSentences(clean);
    const sortedByLength = [...sentences].sort((a, b) => b.length - a.length);
    const keyPointCount = summaryStyle === "brief" ? 3 : summaryStyle === "detailed" ? 6 : sentences.length;
    const keyPoints = sortedByLength.slice(0, Math.min(keyPointCount, sentences.length));

    const entities = this.extractEntities(clean);
    const topics = this.extractKeywords(clean, 5);

    const summary = summaryStyle === "bullet"
      ? keyPoints.map(kp => `- ${kp}`).join("\n")
      : keyPoints.join("; ");

    const data: { keyPoints: string[]; entities?: string[]; topics?: string[] } = { keyPoints };
    if (entities.length > 0) data.entities = entities;
    if (topics.length > 0) data.topics = topics;

    return {
      data,
      summary: summary.length > 500 ? summary.slice(0, 500) + "..." : summary,
      meta: {
        sourceType,
        mode: "summarize",
        confidence: 0.5,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    let match: RegExpExecArray | null;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push(match[0]);
    }
    const urlRegex = /https?:\/\/[^\s,，。；;)]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      entities.push(match[0]);
    }
    const orgRegex = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}/g;
    const orgs = new Set<string>();
    while ((match = orgRegex.exec(text)) !== null) {
      const word = match[0];
      if (word.length > 3 && !word.endsWith("ing") && !word.endsWith("tion")) {
        orgs.add(word);
      }
    }
    for (const org of orgs) entities.push(org);
    return entities;
  }

  private executeTypedObject(
    raw: string,
    sourceType: ExtractorSourceType,
    schema: Readonly<Record<string, unknown>> | undefined,
    schemaRequired: boolean,
    warnings: string[],
  ): ExtractorSuccess {
    if (!schema) {
      if (schemaRequired) {
        throw new ExtractorConfigError("typed-object 模式缺少 schema，且 schemaRequired=true");
      }
      return {
        data: {
          content: raw,
        },
        meta: { sourceType, mode: "typed-object", warnings: ["未提供 schema，已回退为无 schema 模式"] },
      };
    }

    const { clean, meta: preMeta } = this.preprocessSource(raw, sourceType);
    let parsed: Record<string, unknown>;

    if (sourceType === "json" && preMeta["parsed"]) {
      parsed = preMeta["parsed"] as Record<string, unknown>;
    } else {
      parsed = { ...preMeta, content: clean } as Record<string, unknown>;
    }

    const errors: string[] = [];
    const mapped: Record<string, unknown> = {};

    for (const [key, expectedType] of Object.entries(schema)) {
      const val = this.getDeepValue(parsed, key);
      if (val === undefined) {
        errors.push(`缺少必填字段: ${key}`);
        continue;
      }
      if (typeof expectedType === "string") {
        const actualType = typeof val;
        if (actualType !== expectedType && expectedType !== "any") {
          if (expectedType === "array" && !Array.isArray(val)) {
            errors.push(`字段 ${key} 期望类型 ${expectedType}，实际为 ${actualType}`);
          } else if (expectedType === "number" && actualType !== "number") {
            errors.push(`字段 ${key} 期望类型 number，实际为 ${actualType}`);
          }
        }
      }
      mapped[key] = val;
    }

    if (errors.length > 0) {
      return {
        data: { error: "schema_mismatch", fields: errors },
        meta: { sourceType, mode: "typed-object", warnings: errors },
      };
    }

    return {
      data: mapped,
      meta: {
        sourceType,
        mode: "typed-object",
        confidence: 0.9,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  private errorResult(
    errorCode: ExtractorError["errorCode"],
    message: string,
    node: WorkflowNodeIR,
    details?: Record<string, unknown>,
  ): NodeExecutionResult {
    const error: ExtractorError = { errorCode, message, details };
    return {
      output: { error },
      artifacts: [{
        type: "extractor.error",
        data: error,
        targetPath: node.output?.to,
        mergeStrategy: node.output?.mergeStrategy ?? "replace",
      }],
    };
  }
}
