import { promises as fs } from "node:fs";
import path from "node:path";

const SRC_DIRS = [
  "packages/pi-workflow/src",
  "packages/pi-extension-loader/src",
  "packages/pi-package-adapter/src",
  "apps/pi-workflow-cli/src",
];

function parseArgs(argv) {
  const args = {
    minRate: 8,
    json: false,
    includeTests: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--include-tests") {
      args.includeTests = true;
      continue;
    }
    if (token === "--min-rate" && argv[i + 1]) {
      args.minRate = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }
  return args;
}

async function collectTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".d.ts")) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function analyzeFile(content) {
  const lines = content.split(/\r?\n/);
  let commentLines = 0;
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    let isCommentLine = false;

    if (inBlockComment) {
      isCommentLine = true;
      if (line.includes("*/")) {
        inBlockComment = false;
      }
    } else if (line.startsWith("//")) {
      isCommentLine = true;
    } else if (line.startsWith("/*")) {
      isCommentLine = true;
      if (!line.includes("*/")) {
        inBlockComment = true;
      }
    } else if (line.startsWith("*")) {
      isCommentLine = true;
    }

    if (isCommentLine) {
      commentLines += 1;
    }
  }

  return {
    totalLines: lines.length,
    commentLines,
  };
}

function toPercent(numerator, denominator) {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allFiles = [];

  for (const dir of SRC_DIRS) {
    try {
      const files = await collectTsFiles(dir);
      allFiles.push(...files);
    } catch {
      // skip dirs that don't exist
    }
  }

  const scopedFiles = args.includeTests
    ? allFiles
    : allFiles.filter((f) => !f.endsWith(".test.ts"));

  let totalLines = 0;
  let commentLines = 0;

  for (const file of scopedFiles) {
    const content = await fs.readFile(file, "utf8");
    const stats = analyzeFile(content);
    totalLines += stats.totalLines;
    commentLines += stats.commentLines;
  }

  const commentRate = toPercent(commentLines, totalLines);
  const pass = commentRate >= args.minRate;

  const output = {
    scope: args.includeTests
      ? "packages/*/src/**/*.ts(include tests)"
      : "packages/*/src/**/*.ts(exclude tests)",
    totalFiles: scopedFiles.length,
    totalLines,
    commentLines,
    commentRate,
    thresholds: {
      minRate: args.minRate,
    },
    pass,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `Scope: ${output.scope}`,
        `Files: ${output.totalFiles}`,
        `Total lines: ${output.totalLines}`,
        `Comment lines: ${output.commentLines}`,
        `Comment rate: ${output.commentRate}% (threshold: ${args.minRate}%)`,
        `Result: ${output.pass ? "PASS" : "FAIL"}`,
      ].join("\n") + "\n",
    );
  }

  process.exitCode = pass ? 0 : 1;
}

main().catch((error) => {
  console.error("check-comment-rate failed:", error);
  process.exitCode = 1;
});
