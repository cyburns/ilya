import { spawn } from "node:child_process";
import type { Colors } from "./colors.js";
import { createLineBuffer } from "./line-buffer.js";
import { formatMessage, type MessageContext } from "./formatter.js";
import type { Logger } from "./logger.js";

export interface ProxyOptions {
  serverCmd: string;
  serverArgs: string[];
  logger: Logger;
  colors: Colors;
  ctx: MessageContext;
}

/**
 * Start a proxy between the client and the server, logging all messages.
 *
 * @param opts The options for the proxy
 */
export const startProxy = (opts: ProxyOptions): void => {
  const { serverCmd, serverArgs, logger, colors: c, ctx } = opts;

  const child = spawn(serverCmd, serverArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  child.on("error", (err: Error) => {
    const msg = `[ilya] failed to start server: ${err.message}`;
    logger.write(`${c.RED}${msg}${c.RESET}`, msg);
    process.exit(1);
  });

  const clientLineBuffer = createLineBuffer((line) => {
    formatMessage(line, "client", ctx);
    child.stdin.write(line + "\n");
  });

  process.stdin.on("data", (chunk: Buffer) => {
    clientLineBuffer(chunk.toString("utf-8"));
  });

  process.stdin.on("end", () => {
    try {
      child.stdin.end();
    } catch {
      // no-op
    }
  });

  const serverLineBuffer = createLineBuffer((line) => {
    formatMessage(line, "server", ctx);
    process.stdout.write(line + "\n");
  });

  child.stdout.on("data", (chunk: Buffer) => {
    serverLineBuffer(chunk.toString("utf-8"));
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split("\n");

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      const colored = `${c.DIM}[server stderr]${c.RESET} ${line}`;
      const plain = `[server stderr] ${line}`;
      logger.write(colored, plain);
    }
  });

  child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    const exitCode = code ?? (signal ? 1 : 0);
    const msg = signal
      ? `[ilya] server exited with signal ${signal}`
      : `[ilya] server exited with code ${exitCode}`;
    logger.write(`${c.DIM}${msg}${c.RESET}`, msg);
    logger.close();
    process.exit(exitCode);
  });

  /**
   * Shutdown the proxy and the child server process.
   *
   * @param sig The signal that triggered the shutdown
   */
  const shutdown = (sig: string): void => {
    const msg = `[ilya] received ${sig}, shutting down`;
    logger.write(`${c.DIM}${msg}${c.RESET}`, msg);
    try {
      child.kill(sig as NodeJS.Signals);
    } catch {
      // no-op
    }
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // no-op
      }

      logger.close();
      process.exit(1);
    }, 3000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") {
      const msg = "[ilya] client disconnected (EPIPE)";
      logger.write(`${c.DIM}${msg}${c.RESET}`, msg);
      try {
        child.kill("SIGTERM");
      } catch {
        // no-op
      }
    }
  });
};
