import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 加载 CLI 侧 .env 文件。
 * 不覆盖调用进程已经显式设置的环境变量。
 */
export function loadCliEnvFiles(cwd: string = process.cwd()): void {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const envPath = resolve(cwd, file);
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath, override: false });
    }
  }
}
