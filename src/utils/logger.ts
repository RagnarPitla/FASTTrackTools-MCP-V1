/**
 * Logger utility that writes to stderr (safe for stdio MCP transport).
 * Never use console.log() in MCP servers -- it writes to stdout and corrupts JSON-RPC.
 */
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.error(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.error(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG === "true") {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  },
};
