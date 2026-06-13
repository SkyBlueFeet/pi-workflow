/**
 * pi-studio 宿主命令实现 — 基于 yargs。
 *
 * 职责：
 * 1. 默认输出 pi-studio help 信息
 * 2. --console 进入宿主级控制台
 */

import yargs from "yargs";
import { startStudioConsole } from "../console/studio-console-shell.js";

/** pi-studio help 文案（已按照产品口径固化）。 */
export const STUDIO_HELP = `pi-studio
  产品级宿主入口

用法:
  pi-studio --console

说明:
  默认显示帮助信息
  --console 进入宿主级控制台

相关命令:
  pi-workflow   workflow 运行与调试入口
  pi-agent      独立 agent 入口
`;

/**
 * studio 命令入口。
 *
 * @param argv 命令行原始参数（不含 node 和脚本名）
 */
export async function studioCommand(argv: string[]): Promise<void> {
  const y = yargs(argv)
    .scriptName("pi-studio")
    .usage(STUDIO_HELP)
    .option("console", {
      type: "boolean",
      describe: "进入宿主级控制台",
    })
    .alias("h", "help")
    .help()
    .version(false)
    .exitProcess(false)
    .strict();

  const args = await y.parse();

  if (args.console) {
    await startStudioConsole();
    return;
  }

  // 无参数时自动显示帮助（"log" 使输出到 stdout，与 yargs 内置 --help 一致）
  if (argv.length === 0) {
    y.showHelp("log");
    return;
  }
}
