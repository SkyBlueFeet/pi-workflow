#!/usr/bin/env node

import { loadCliEnvFiles } from "./env.js";
loadCliEnvFiles();

import { studioCommand } from "./commands/studio.js";
import { hideBin } from "yargs/helpers";

/**
 * pi-studio CLI 主入口。
 *
 * 对外命令形态：
 *   pi-studio           → 显示 help
 *   pi-studio --console → 进入宿主级控制台
 *   pi-studio --help    → 显示 help
 */
studioCommand(hideBin(process.argv)).catch((err) => {
  console.error(err);
  process.exit(1);
});
