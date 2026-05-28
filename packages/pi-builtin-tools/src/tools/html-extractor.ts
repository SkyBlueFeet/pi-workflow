const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const CODE_BLOCK_PATTERN = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
const INLINE_CODE_PATTERN = /<code\b[^>]*>([\s\S]*?)<\/code>/gi;
const TABLE_PATTERN = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
const IMAGE_PATTERN = /<img\b([^>]*?)>/gi;
const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const HEADING_PATTERN = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
const LIST_ITEM_PATTERN = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const BLOCK_TAG_PATTERN = /<(p|div|section|article|main|aside|header|footer|blockquote|pre|ul|ol|nav|figure)\b[^>]*>/gi;

/** 提取 HTML 页面标题。 */
export function extractHtmlTitle(html: string): string | undefined {
  const match = TITLE_PATTERN.exec(html);
  if (!match?.[1]) {
    return undefined;
  }
  return decodeHtmlEntities(normalizeWhitespace(match[1]));
}

/** 将 HTML 转换为 text 或 markdown。 */
export function formatHtmlContent(html: string, format: "markdown" | "text" | "html", baseUrl: string): string {
  if (format === "html") {
    return html;
  }

  const title = extractHtmlTitle(html);
  const body = cleanHtmlToText(html, format === "markdown", baseUrl);
  if (!title) {
    return body;
  }
  if (format === "markdown") {
    return `# ${title}\n\n${body}`.trim();
  }
  return `${title}\n\n${body}`.trim();
}

function cleanHtmlToText(html: string, markdownMode: boolean, baseUrl: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  const withStructure = withoutScripts
    .replace(CODE_BLOCK_PATTERN, (_full, code: string) => formatCodeBlock(code, markdownMode))
    .replace(TABLE_PATTERN, (_full, tableHtml: string) => formatTable(tableHtml, markdownMode, baseUrl))
    .replace(IMAGE_PATTERN, (_full, attrs: string) => formatImage(attrs, markdownMode, baseUrl))
    .replace(HEADING_PATTERN, (_full, tag: string, text: string) => {
      const level = Number(tag.slice(1));
      const prefix = markdownMode ? `${"#".repeat(level)} ` : "";
      return `\n\n${prefix}${stripInlineHtml(text)}\n\n`;
    })
    .replace(LINK_PATTERN, (_full, href: string, text: string) => {
      const label = stripInlineHtml(text);
      const resolvedHref = resolveUrl(baseUrl, href);
      if (!markdownMode) {
        return `${label} (${resolvedHref})`;
      }
      return `[${label}](${resolvedHref})`;
    })
    .replace(INLINE_CODE_PATTERN, (_full, code: string) => formatInlineCode(code, markdownMode))
    .replace(LIST_ITEM_PATTERN, (_full, text: string) => `\n- ${stripInlineHtml(text)}`)
    .replace(BLOCK_TAG_PATTERN, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/[^>]+>/g, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(normalizeWhitespace(withStructure));
}

function formatCodeBlock(code: string, markdownMode: boolean): string {
  const text = decodeHtmlEntities(code.replace(/<[^>]+>/g, "")).trim();
  if (!text) {
    return "\n\n";
  }
  if (!markdownMode) {
    return `\n\n${text}\n\n`;
  }
  return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
}

function formatInlineCode(code: string, markdownMode: boolean): string {
  const text = stripInlineHtml(code);
  if (!text) {
    return "";
  }
  return markdownMode ? `\`${text}\`` : text;
}

function formatTable(tableHtml: string, markdownMode: boolean, baseUrl: string): string {
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((match) => Array.from(match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))
      .map((cell) => stripInlineHtml(rewriteInlineLinks(cell[1], markdownMode, baseUrl))));

  if (rows.length === 0) {
    return "\n\n";
  }
  if (!markdownMode) {
    return `\n\n${rows.map((row) => row.join(" | ")).join("\n")}\n\n`;
  }

  const header = rows[0];
  const width = Math.max(...rows.map((row) => row.length));
  const divider = header.map(() => "---");
  const body = rows.slice(1).map((row) => padRow(row, width));
  const markdownRows = [padRow(header, width), padRow(divider, width), ...body].map((row) => `| ${row.join(" | ")} |`);
  return `\n\n${markdownRows.join("\n")}\n\n`;
}

function formatImage(attrs: string, markdownMode: boolean, baseUrl: string): string {
  const alt = extractAttribute(attrs, "alt");
  const src = extractAttribute(attrs, "src");
  if (!src && !alt) {
    return " ";
  }
  const resolvedSrc = src ? resolveUrl(baseUrl, src) : undefined;
  if (!markdownMode) {
    if (alt && resolvedSrc) {
      return `${alt} (${resolvedSrc})`;
    }
    return alt ?? resolvedSrc ?? " ";
  }
  if (resolvedSrc) {
    return `![${alt ?? "image"}](${resolvedSrc})`;
  }
  return alt ?? " ";
}

function rewriteInlineLinks(value: string, markdownMode: boolean, baseUrl: string): string {
  return value.replace(LINK_PATTERN, (_full, href: string, text: string) => {
    const label = stripInlineHtml(text);
    const resolvedHref = resolveUrl(baseUrl, href);
    if (!markdownMode) {
      return `${label} (${resolvedHref})`;
    }
    return `[${label}](${resolvedHref})`;
  });
}

function resolveUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function extractAttribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attrs);
  return match?.[1] ? decodeHtmlEntities(match[1]) : undefined;
}

function padRow(row: string[], width: number): string[] {
  const result = [...row];
  while (result.length < width) {
    result.push("");
  }
  return result;
}

function stripInlineHtml(value: string): string {
  return decodeHtmlEntities(normalizeWhitespace(value.replace(/<[^>]+>/g, " ")));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
