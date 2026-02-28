import type { Colors } from "./colors.js";
import { methodColor } from "./colors.js";
import type { Logger } from "./logger.js";
import type { PendingRequest } from "./result-formatter.js";
import { formatResult } from "./result-formatter.js";
import { timestamp, truncate } from "./utils.js";

export interface MessageContext {
  logger: Logger;
  colors: Colors;
  plainColors: Colors;
  pendingRequests: Map<string | number, PendingRequest>;
}

/**
 * Format a JSON-RPC message for logging.
 *
 * @param json The JSON-RPC message as a string
 * @param direction The direction of the message, either "client" or "server"
 * @param ctx The context for formatting, including logger, colors, and pending requests
 * @returns void
 */
export const formatMessage = (
  json: string,
  direction: "client" | "server",
  ctx: MessageContext,
): void => {
  const { logger, colors: c, plainColors: pc, pendingRequests } = ctx;

  const isClient = direction === "client";
  const arrow = isClient ? "→" : "←";
  const label = isClient ? "CLIENT" : "SERVER";
  const dirColor = isClient ? c.CYAN : c.GREEN;

  const ts = timestamp();

  try {
    const msg = JSON.parse(json) as Record<string, unknown>;
    const id = msg.id as string | number | undefined;
    const method = msg.method as string | undefined;

    if (method && id === undefined) {
      const mc = methodColor(method, c);
      const colored = `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.BLUE}notification${c.RESET}  ${mc}${method}${c.RESET}`;
      const plain = `${ts} ${arrow} ${label}  notification  ${method}`;
      logger.write(colored, plain);

      const params = msg.params as Record<string, unknown> | undefined;
      if (params && Object.keys(params).length > 0) {
        const paramStr = truncate(JSON.stringify(params), 200);
        logger.write(`    ${c.DIM}${paramStr}${c.RESET}`, `    ${paramStr}`);
      }
      return;
    }

    if (method && id !== undefined) {
      const mc = methodColor(method, c);

      let toolName: string | null = null;

      const params = msg.params as Record<string, unknown> | undefined;

      if (method === "tools/call" && params?.name) {
        toolName = params.name as string;
      }

      pendingRequests.set(id, { method, toolName, ts: Date.now() });

      const extra = toolName ? `  ${c.BOLD}${toolName}${c.RESET}` : "";
      const extraPlain = toolName ? `  ${toolName}` : "";
      const colored = `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.WHITE}request${c.RESET}  ${mc}${method}${c.RESET}${extra}  ${c.DIM}#${id}${c.RESET}`;
      const plain = `${ts} ${arrow} ${label}  request  ${method}${extraPlain}  #${id}`;
      logger.write(colored, plain);

      if (method === "tools/call" && params?.arguments) {
        const argStr = JSON.stringify(params.arguments, null, 2);
        const lines = argStr.split("\n");
        for (const line of lines) {
          logger.write(`    ${c.DIM}${line}${c.RESET}`, `    ${line}`);
        }
      } else if (params && Object.keys(params).length > 0) {
        const paramStr = truncate(JSON.stringify(params), 200);
        logger.write(`    ${c.DIM}${paramStr}${c.RESET}`, `    ${paramStr}`);
      }
      return;
    }

    if (id !== undefined && !method) {
      const pending = pendingRequests.get(id);
      const reqMethod = pending?.method || "unknown";
      const mc = methodColor(reqMethod, c);
      const elapsed = pending ? `${Date.now() - pending.ts}ms` : "";

      const error = msg.error as
        | { code?: number; message?: string }
        | undefined;

      if (error) {
        const code = error.code || "?";
        const errMsg = error.message || "Unknown error";
        const colored = `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.RED}${c.BOLD}ERROR${c.RESET}  ${mc}(${reqMethod} #${id})${c.RESET}  ${c.DIM}${elapsed}${c.RESET}`;
        const plain = `${ts} ${arrow} ${label}  ERROR  (${reqMethod} #${id})  ${elapsed}`;
        logger.write(colored, plain);
        logger.write(
          `    ${c.RED}[${code}] ${errMsg}${c.RESET}`,
          `    [${code}] ${errMsg}`,
        );
        pendingRequests.delete(id);
        return;
      }

      const colored = `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.WHITE}response${c.RESET}  ${mc}${reqMethod}${c.RESET}  ${c.DIM}#${id}  ${elapsed}${c.RESET}`;
      const plain = `${ts} ${arrow} ${label}  response  ${reqMethod}  #${id}  ${elapsed}`;
      logger.write(colored, plain);

      formatResult(
        reqMethod,
        msg.result as Record<string, unknown> | undefined,
        pending,
        {
          logger,
          colors: c,
          plainColors: pc,
        },
      );

      pendingRequests.delete(id);
      return;
    }

    const raw = truncate(json.trim(), 200);
    logger.write(
      `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.DIM}${raw}${c.RESET}`,
      `${ts} ${arrow} ${label}  ${raw}`,
    );
  } catch {
    const raw = truncate(json.trim(), 200);
    logger.write(
      `${c.DIM}${ts}${c.RESET} ${dirColor}${arrow} ${label}${c.RESET}  ${c.YELLOW}[raw]${c.RESET} ${raw}`,
      `${ts} ${arrow} ${label}  [raw] ${raw}`,
    );
  }
};
