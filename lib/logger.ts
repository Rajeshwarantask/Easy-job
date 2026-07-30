/**
 * Leveled, structured logger.
 *
 * Replaces the ad-hoc `console.log("[Pipeline] ...")` / `[v0-STAGE-DEBUG]`
 * calls scattered across the pipeline. Log level is controlled by the
 * LOG_LEVEL env var (`debug` | `info` | `warn` | `error` | `silent`).
 * Defaults to `info` in production and `debug` otherwise.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function resolveLevel(): LogLevel {
  const fromEnv = (process.env.LOG_LEVEL as LogLevel | undefined)?.toLowerCase() as
    | LogLevel
    | undefined;
  if (fromEnv && fromEnv in LEVEL_WEIGHT) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const activeWeight = LEVEL_WEIGHT[resolveLevel()];

function emit(level: Exclude<LogLevel, "silent">, scope: string, msg: string, meta?: unknown) {
  if (LEVEL_WEIGHT[level] < activeWeight) return;
  const prefix = `[${scope}]`;
  const line = `${prefix} ${msg}`;
  const args = meta === undefined ? [line] : [line, meta];
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else console.log(...args);
}

export interface Logger {
  debug: (msg: string, meta?: unknown) => void;
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  child: (childScope: string) => Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, meta) => emit("debug", scope, msg, meta),
    info: (msg, meta) => emit("info", scope, msg, meta),
    warn: (msg, meta) => emit("warn", scope, msg, meta),
    error: (msg, meta) => emit("error", scope, msg, meta),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}
