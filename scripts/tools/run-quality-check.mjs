import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const STANDARDS = {
  commentRateMin: 8,
  fileLineMax: 250,
  testFileLineMax: 300,
  fileRiskLine: 180,
};

const SRC_DIRS = [
  "packages/pi-workflow/src",
  "packages/pi-extension-loader/src",
  "packages/pi-package-adapter/src",
  "apps/pi-workflow-cli/src",
];

const REPORT_DIR = path.join("developers", "REPORTS");

function toStatusText(pass) {
  return pass ? "PASS" : "FAIL";
}

function getNowParts() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const fileStamp = `${date}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
  return { date, time, fileStamp };
}

function runCommand(commandLine) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        output: `${stdout}${stderr}\n${String(error)}`.trim(),
      });
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        output: `${stdout}${stderr}`.trim(),
      });
    });
  });
}

function getLastLinesText(text, maxLines = 12) {
  if (!text || !text.trim()) {
    return "(no output)";
  }
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n").trim();
}

function parseJsonSafe(text) {
  const raw = text.trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function collectTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      continue;
    }
    files.push(full);
  }
  return files;
}

function isCommentOnlyLine(rawLine, context) {
  const line = rawLine.trim();
  if (!line) {
    return false;
  }

  if (context.inBlockComment) {
    if (line.includes("*/")) {
      context.inBlockComment = false;
      const tail = line.split("*/").slice(1).join("*/").trim();
      return tail.length === 0;
    }
    return true;
  }

  if (line.startsWith("//")) {
    return true;
  }
  if (line.startsWith("/*")) {
    if (!line.includes("*/")) {
      context.inBlockComment = true;
      return true;
    }
    const tail = line.split("*/").slice(1).join("*/").trim();
    return tail.length === 0;
  }
  if (line.startsWith("*")) {
    return true;
  }
  return false;
}

async function getNonCommentLineCount(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const context = { inBlockComment: false };
  let nonCommentLines = 0;

  for (const rawLine of lines) {
    if (!isCommentOnlyLine(rawLine, context)) {
      nonCommentLines += 1;
    }
  }
  return nonCommentLines;
}

async function main() {
  const lint = await runCommand("npm run lint");
  const tests = await runCommand("npm run test");
  const comment = await runCommand(
    `node scripts/tools/check-comment-rate.mjs --json --min-rate ${STANDARDS.commentRateMin}`,
  );

  const commentJson = parseJsonSafe(comment.output) ?? {
    totalLines: 0,
    commentLines: 0,
    commentRate: 0,
    pass: false,
  };

  const allFiles = [];
  for (const dir of SRC_DIRS) {
    try {
      const files = await collectTsFiles(dir);
      allFiles.push(...files);
    } catch {
      // skip dirs that don't exist
    }
  }

  const violations = [];
  const risks = [];

  for (const file of allFiles) {
    const nonCommentLines = await getNonCommentLineCount(file);
    const normalized = file.replaceAll("\\", "/");
    const isTest = normalized.endsWith(".test.ts");
    const max = isTest ? STANDARDS.testFileLineMax : STANDARDS.fileLineMax;

    if (nonCommentLines > max) {
      violations.push({ file: normalized, lines: nonCommentLines, max });
      continue;
    }
    if (nonCommentLines > STANDARDS.fileRiskLine) {
      risks.push({ file: normalized, lines: nonCommentLines });
    }
  }

  const lintPass = lint.exitCode === 0;
  const testPass = tests.exitCode === 0;
  const commentPass = commentJson.pass === true;
  const fileLinePass = violations.length === 0;
  const overallPass = lintPass && testPass && commentPass && fileLinePass;

  const violationRows =
    violations.length === 0
      ? "| none | - | - |"
      : violations.map((item) => `| ${item.file} | ${item.lines} | ${item.max} |`).join("\n");
  const riskRows =
    risks.length === 0
      ? "| none | - |"
      : risks.map((item) => `| ${item.file} | ${item.lines} |`).join("\n");

  await fs.mkdir(REPORT_DIR, { recursive: true });
  const { date, time, fileStamp } = getNowParts();
  const reportPath = path.join(REPORT_DIR, `CODE_QUALITY_REPORT_${fileStamp}.md`);

  const reportLines = [
    `# Code Quality Report: ${date} ${time}`,
    "",
    "## 1. Meta",
    "",
    `- Check Time: ${date} ${time} +08:00`,
    "- Scope: packages/*/src/**/*.ts, apps/*/src/**/*.ts",
    "- Standard Source: developers/CODE-STYLES/TYPESCRIPT_CODE-STYLE.md",
    "",
    "## 2. Standards",
    "",
    "| Dimension | Standard | Status |",
    "|---|---|---|",
    `| Lint baseline | npm run lint must pass | ${toStatusText(lintPass)} |`,
    `| Test baseline | npm run test must pass | ${toStatusText(testPass)} |`,
    `| Comment rate | >= ${STANDARDS.commentRateMin}% | ${toStatusText(commentPass)} |`,
    `| File size (exclude comments) | source <= ${STANDARDS.fileLineMax}, test <= ${STANDARDS.testFileLineMax} | ${toStatusText(fileLinePass)} |`,
    "",
    "## 3. Automated Results",
    "",
    "### 3.1 Lint and Tests",
    "",
    "| Item | Command | Status | Exit Code |",
    "|---|---|---|---|",
    `| lint | npm run lint | ${toStatusText(lintPass)} | ${lint.exitCode} |`,
    `| tests | npm run test | ${toStatusText(testPass)} | ${tests.exitCode} |`,
    "",
    "### 3.2 Comment Metrics",
    "",
    `- Total lines: ${commentJson.totalLines}`,
    `- Comment lines: ${commentJson.commentLines}`,
    `- Comment rate: ${commentJson.commentRate}%`,
    `- Status: ${toStatusText(commentPass)}`,
    "",
    "### 3.3 File Size Check",
    "",
    `- Scanned files: ${allFiles.length}`,
    `- Status: ${toStatusText(fileLinePass)}`,
    "",
    "Hard violations (non-comment lines):",
    "",
    "| File | Non-comment lines | Limit |",
    "|---|---:|---:|",
    violationRows,
    "",
    `Risk files (>${STANDARDS.fileRiskLine} non-comment lines):`,
    "",
    "| File | Non-comment lines |",
    "|---|---:|",
    riskRows,
    "",
    "## 4. Manual Dimensions",
    "",
    "| Dimension | Conclusion | Notes |",
    "|---|---|---|",
    "| Modularization | Needs improvement | Large files still exist (workflow-runtime.ts, executor-registry.ts) |",
    "| Single responsibility | Needs improvement | Some files still mix concerns |",
    "| Robustness | Medium | Validation exists; edge cases need strengthening |",
    "",
    "## 5. Conclusion",
    "",
    `- Overall: **${toStatusText(overallPass)}**`,
    "- Next actions:",
    "  1. Fix failed checks before feature acceptance.",
    "  2. Split risk and overflow files before adding more logic.",
    "  3. Increase Chinese comments on boundary/error/protocol mapping code.",
    "",
    "## 6. Output Snippets",
    "",
    "~~~text",
    "[lint]",
    getLastLinesText(lint.output),
    "~~~",
    "",
    "~~~text",
    "[tests]",
    getLastLinesText(tests.output),
    "~~~",
    "",
    "~~~text",
    "[comment]",
    getLastLinesText(comment.output),
    "~~~",
  ];

  await fs.writeFile(reportPath, `${reportLines.join("\n")}\n`, "utf8");

  const reportPathForDisplay = reportPath.replaceAll("\\", "/");
  process.stdout.write(`Report generated: ${reportPathForDisplay}\n`);
  process.stdout.write(`Overall status: ${toStatusText(overallPass)}\n`);
  process.exitCode = overallPass ? 0 : 1;
}

main().catch((error) => {
  console.error("run-quality-check failed:", error);
  process.exitCode = 1;
});
