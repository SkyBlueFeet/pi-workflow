/**
 * pi-studio 宿主命令实现。
 *
 * 职责：
 * 1. 默认输出 pi-studio help 信息
 * 2. --console 进入宿主级控制台
 */

import { startStudioConsole } from "../console/studio-console-shell.js";

/** pi-studio help 文案（已按照产品口径固化）。 */
const STUDIO_HELP = `pi-studio
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
 * @param args 命令行参数，不含命令名本身
 */
export async function studioCommand(args: string[]): Promise<void> {
  if (args.includes("--console")) {
    await startStudioConsole();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(STUDIO_HELP.trim());
    return;
  }

  // 默认显示 help
  console.log(STUDIO_HELP.trim());
}
