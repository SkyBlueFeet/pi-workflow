const CLI_PACKAGE_NAME = "pi-workflow-cli";
const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_MAGENTA = "\u001b[35m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";

type CliLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_PRIORITY: Record<CliLogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export interface CliLogger {
  debug(message: string, ...args: readonly unknown[]): void;
  info(message: string, ...args: readonly unknown[]): void;
  warn(message: string, ...args: readonly unknown[]): void;
  error(message: string, ...args: readonly unknown[]): void;
}

/**
 * 创建带固定 scope 的 CLI 日志器，输出格式接近常见 Java/logger 风格。
 *
 * @param scope 当前命令或模块名，如 run/build/trace
 * @param debugEnabled 是否启用 debug 级别输出
 */
export function createLogger(scope: string, debugEnabled = false): CliLogger {
  const minLevel = resolveMinLevel(debugEnabled);

  return {
    debug(message: string, ...args: readonly unknown[]): void {
      if (!shouldLog("DEBUG", minLevel)) {
        return;
      }
      writeLog("DEBUG", scope, message, ...args);
    },
    info(message: string, ...args: readonly unknown[]): void {
      if (!shouldLog("INFO", minLevel)) {
        return;
      }
      writeLog("INFO", scope, message, ...args);
    },
    warn(message: string, ...args: readonly unknown[]): void {
      if (!shouldLog("WARN", minLevel)) {
        return;
      }
      writeLog("WARN", scope, message, ...args);
    },
    error(message: string, ...args: readonly unknown[]): void {
      if (!shouldLog("ERROR", minLevel)) {
        return;
      }
      writeLog("ERROR", scope, message, ...args);
    },
  };
}

function resolveMinLevel(debugEnabled: boolean): CliLogLevel {
  const envLevel = normalizeLogLevel(process.env.PI_WORKFLOW_LOG_LEVEL);
  if (envLevel) {
    return envLevel;
  }
  return debugEnabled ? "DEBUG" : "INFO";
}

function normalizeLogLevel(value: string | undefined): CliLogLevel | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "DEBUG" || normalized === "INFO" || normalized === "WARN" || normalized === "ERROR") {
    return normalized;
  }
  return undefined;
}

function shouldLog(level: CliLogLevel, minLevel: CliLogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function writeLog(level: CliLogLevel, scope: string, message: string, ...args: readonly unknown[]): void {
  console.error(formatPrefix(level, scope), message, ...args);
}

function formatPrefix(level: CliLogLevel, scope: string): string {
  const timestamp = formatTimestamp(new Date());
  return `${ANSI_DIM}[${timestamp}]${ANSI_RESET} ${ANSI_CYAN}[${CLI_PACKAGE_NAME}]${ANSI_RESET} ${colorizeLevel(level)} ${ANSI_MAGENTA}[${scope}]${ANSI_RESET}`;
}

function colorizeLevel(level: CliLogLevel): string {
  switch (level) {
    case "DEBUG":
      return `${ANSI_BLUE}[DEBUG]${ANSI_RESET}`;
    case "INFO":
      return `${ANSI_GREEN}[INFO]${ANSI_RESET}`;
    case "WARN":
      return `${ANSI_YELLOW}[WARN]${ANSI_RESET}`;
    case "ERROR":
      return `${ANSI_RED}[ERROR]${ANSI_RESET}`;
  }
}

function formatTimestamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
