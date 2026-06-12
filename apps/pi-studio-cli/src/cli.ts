#!/usr/bin/env node

import { loadCliEnvFiles } from "./env.js";
loadCliEnvFiles();

import { studioCommand } from "./commands/studio.js";

/**
 * pi-studio CLI 主入口。
 *
 * 对外命令形态：
 *   pi-studio           → 显示 help
 *   pi-studio --console → 进入宿主级控制台
 *   pi-studio --help    → 显示 help
 */
export async function main(argv: readonly string[]): Promise<void> {
  const args = argv.slice(2);
  await studioCommand(args);
}

await main(process.argv);
