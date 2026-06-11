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

/**
 * 解析 CLI 运行时的模型覆盖。
 * 显式 --model 优先；未指定时回退到统一测试模型环境变量。
 */
export function resolveCliModelOverride(explicitModel?: string): string | undefined {
  const envModel = process.env["PI_WORKFLOW_TEST_MODEL"]?.trim();
  if (explicitModel && explicitModel.trim().length > 0) {
    return explicitModel.trim();
  }
  return envModel && envModel.length > 0 ? envModel : undefined;
}

/**
 * 解析 workflow run/resume 的默认模型。
 * 仅用于补充工作流级默认模型，不覆盖节点显式传入的 model。
 */
export function resolveCliWorkflowDefaultModel(): string | undefined {
  const envModel = process.env["PI_WORKFLOW_DEFAULT_MODEL"]?.trim();
  return envModel && envModel.length > 0 ? envModel : undefined;
}
