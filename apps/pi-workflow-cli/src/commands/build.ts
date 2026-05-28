import { resolve } from "node:path";
import { buildPwbFromDirectory } from "@pi-workflow/core";
import { createLogger } from "./logger.js";

/**
 * build 命令：将目录式 workflow 构建为单文件 .pwb bundle。
 * 退出码：0 正常，1 构建失败。
 *
 * @param args 命令行参数，args[0] 为 workflow 目录路径
 *   支持 --out <file>、--overwrite、--debug
 */
export async function buildCommand(args: string[]): Promise<void> {
  if (args.length < 1 || args[0] === "--help") {
    console.log("用法: pi-workflow build <workflow-dir> [--out <file>] [--overwrite] [--debug]");
    console.log("  <workflow-dir>   包含 flow.json 的工作流目录");
    console.log("  --out <file>     输出 .pwb 文件路径（默认：<workflow-dir>.pwb）");
    console.log("  --overwrite      覆盖已存在的输出文件");
    console.log("  --debug          输出详细调试信息");
    process.exit(args.length < 1 ? 1 : 0);
  }

  const workflowDir = resolve(process.cwd(), args[0]);
  const debug = args.includes("--debug");
  const logger = createLogger("build", debug);
  const overwrite = args.includes("--overwrite");
  const outIndex = args.indexOf("--out");
  const outFile = outIndex !== -1 && outIndex + 1 < args.length
    ? args[outIndex + 1]
    : `${args[0].replace(/[\\/]$/, "")}.pwb`;

  logger.debug("workflow 目录:", workflowDir);
  logger.debug("输出文件:", outFile);

  const result = buildPwbFromDirectory(workflowDir, { outFile, overwrite, debug });

  for (const d of result.diagnostics) {
    const prefix = d.severity === "error" ? "错误" : "警告";
    if (d.severity === "error") logger.error(`${prefix} ${d.code}: ${d.message}`);
    else logger.warn(`${prefix} ${d.code}: ${d.message}`);
  }

  if (result.diagnostics.some(d => d.severity === "error")) {
    logger.debug("构建失败");
    process.exit(1);
  }

  const resCount = result.manifest.resources.length;
  console.log(`构建成功: ${result.pwbPath || outFile}`);
  console.log(`  工作流: ${result.manifest.workflow.title || result.manifest.workflow.id}`);
  console.log(`  文档: document.json (${result.manifest.document.size} bytes)`);
  console.log(`  资源: ${resCount} 个`);
  logger.debug("构建完成");
}
