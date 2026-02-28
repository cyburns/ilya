import type { Colors } from "./colors.js";
import type { Logger } from "./logger.js";
import { truncate } from "./utils.js";

export interface PendingRequest {
  method: string;
  toolName: string | null;
  ts: number;
}

export interface FormatterContext {
  logger: Logger;
  colors: Colors;
  plainColors: Colors;
}

/**
 * Format the result of a request and log it.
 *
 * @param method The method of the request
 * @param result The result of the request
 * @param _pending The pending request associated with this result
 * @param ctx The formatter context containing the logger and colors
 * @returns void
 */
export const formatResult = (
  method: string,
  result: Record<string, unknown> | undefined,
  _pending: PendingRequest | undefined,
  ctx: FormatterContext,
): void => {
  if (!result) return;

  const { logger, colors: c, plainColors: pc } = ctx;

  if (method === "tools/list" && Array.isArray(result.tools)) {
    const tools = result.tools as Array<{ name: string }>;
    const names = tools.map((t) => t.name);
    const summary =
      names.length <= 8
        ? names.join(", ")
        : names.slice(0, 6).join(", ") + `, ... +${names.length - 6} more`;
    logger.write(
      `    ${c.GREEN}(${tools.length} tools: ${summary})${c.RESET}`,
      `    (${tools.length} tools: ${summary})`,
    );
    return;
  }

  if (method === "resources/list" && Array.isArray(result.resources)) {
    const resources = result.resources as Array<{ name?: string; uri: string }>;
    const names = resources.map((r) => r.name || r.uri);
    const summary =
      names.length <= 8
        ? names.join(", ")
        : names.slice(0, 6).join(", ") + `, ... +${names.length - 6} more`;
    logger.write(
      `    ${c.CYAN}(${resources.length} resources: ${summary})${c.RESET}`,
      `    (${resources.length} resources: ${summary})`,
    );
    return;
  }

  // prompts/list — summarize
  if (method === "prompts/list" && Array.isArray(result.prompts)) {
    const prompts = result.prompts as Array<{ name: string }>;
    const names = prompts.map((p) => p.name);
    const summary =
      names.length <= 8
        ? names.join(", ")
        : names.slice(0, 6).join(", ") + `, ... +${names.length - 6} more`;
    logger.write(
      `    ${c.YELLOW}(${prompts.length} prompts: ${summary})${c.RESET}`,
      `    (${prompts.length} prompts: ${summary})`,
    );
    return;
  }

  // tools/call — show content blocks
  if (method === "tools/call" && Array.isArray(result.content)) {
    const content = result.content as Array<Record<string, unknown>>;
    for (const block of content) {
      if (block.type === "text") {
        const lines = (block.text as string).split("\n");
        for (const line of lines) {
          logger.write(
            `    ${c.DIM}[text]${c.RESET} ${line}`,
            `    [text] ${line}`,
          );
        }
      } else if (block.type === "image") {
        const data = block.data as string | undefined;
        const size = data
          ? `${Math.round((data.length * 3) / 4 / 1024)}KB`
          : "?";
        logger.write(
          `    ${c.DIM}[image ${block.mimeType || "?"}]${c.RESET} ${size}`,
          `    [image ${block.mimeType || "?"}] ${size}`,
        );
      } else if (block.type === "resource") {
        const resource = block.resource as { uri?: string } | undefined;
        const uri = resource?.uri || "?";
        logger.write(
          `    ${c.DIM}[resource]${c.RESET} ${truncate(uri)}`,
          `    [resource] ${truncate(uri)}`,
        );
      } else {
        const raw = truncate(JSON.stringify(block), 200);
        logger.write(
          `    ${c.DIM}[${block.type || "?"}]${c.RESET} ${raw}`,
          `    [${block.type || "?"}] ${raw}`,
        );
      }
    }
    if (result.isError) {
      logger.write(
        `    ${c.RED}(isError: true)${c.RESET}`,
        `    (isError: true)`,
      );
    }
    return;
  }

  // initialize — show capabilities
  if (method === "initialize" && result.capabilities) {
    const caps = Object.keys(result.capabilities as object).join(", ");
    const serverInfo = result.serverInfo as
      | { name?: string; version?: string }
      | undefined;
    const name = serverInfo?.name || "?";
    const version = serverInfo?.version || "?";
    logger.write(
      `    ${c.MAGENTA}${name} v${version}${c.RESET}  capabilities: ${caps}`,
      `    ${name} v${version}  capabilities: ${caps}`,
    );
    return;
  }

  // Generic: show truncated JSON
  const raw = JSON.stringify(result);
  if (raw.length > 2) {
    const display = truncate(raw, 300);
    logger.write(`    ${c.DIM}${display}${c.RESET}`, `    ${display}`);
  }
};
