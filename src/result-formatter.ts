import type { Colors } from "./colors.js";
import type { Logger } from "./logger.js";
import { truncate } from "./utils.js";

const NOISE_FIELDS = new Set(["id", "timestamp"]);

/**
 * Recursively truncate arrays to maxItems, appending a "... +N more" marker.
 *
 * @param obj The object to truncate
 * @param maxItems The maximum number of items to keep `in arrays
 * @returns The truncated object
 */
export const truncateArrays = (obj: unknown, maxItems: number = 3): unknown => {
  if (Array.isArray(obj)) {
    const truncated = obj
      .slice(0, maxItems)
      .map((item) => truncateArrays(item, maxItems));

    if (obj.length > maxItems) {
      truncated.push(`... +${obj.length - maxItems} more`);
    }

    return truncated;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = truncateArrays(value, maxItems);
    }

    return result;
  }

  return obj;
};

/**
 * Truncate string values longer than maxLen inside a parsed JSON structure.
 *
 * @param obj The object to truncate string values in
 * @param maxLen The maximum length of string values
 * @returns The object with truncated string values
 */
export const truncateStringValues = (
  obj: unknown,
  maxLen: number = 100,
): unknown => {
  if (typeof obj === "string") {
    if (obj.length > maxLen) return obj.slice(0, maxLen - 3) + "...";
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateStringValues(item, maxLen));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = truncateStringValues(value, maxLen);
    }

    return result;
  }

  return obj;
};

/**
 * Remove noisy fields (id, timestamp, empty graphql) from items inside arrays.
 * Only strips from array elements, not top-level objects.
 *
 * @param obj The object to remove noise fields from
 * @param insideArray Whether the current object is inside an array
 * @returns The object with noise fields removed
 */
export const removeNoiseFields = (
  obj: unknown,
  insideArray: boolean = false,
): unknown => {
  if (Array.isArray(obj)) {
    return obj.map((item) => removeNoiseFields(item, true));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (insideArray && NOISE_FIELDS.has(key)) continue;

      if (
        insideArray &&
        key === "graphql" &&
        value !== null &&
        typeof value === "object" &&
        Object.keys(value as object).length === 0
      ) {
        continue;
      }
      result[key] = removeNoiseFields(value, false);
    }

    return result;
  }

  return obj;
};

/**
 * Try to parse text as JSON and pretty-print it with truncation.
 * Returns null if the text is not valid JSON.
 *
 * @param text The text to parse as JSON
 * @returns The pretty-printed JSON string or null if parsing fails
 */
export const tryFormatJson = (text: string): string | null => {
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") return null;
    const truncated = truncateArrays(parsed);
    const cleaned = removeNoiseFields(truncated);
    const shortened = truncateStringValues(cleaned);
    return JSON.stringify(shortened, null, 2);
  } catch {
    return null;
  }
};

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
        const text = block.text as string;
        const formatted = tryFormatJson(text);
        if (formatted !== null) {
          logger.write(`    ${c.DIM}[text]${c.RESET}`, `    [text]`);
          for (const line of formatted.split("\n")) {
            logger.write(
              `    ${c.DIM}    ${line}${c.RESET}`,
              `        ${line}`,
            );
          }
        } else {
          const lines = text.split("\n");
          for (const line of lines) {
            logger.write(
              `    ${c.DIM}[text]${c.RESET} ${line}`,
              `    [text] ${line}`,
            );
          }
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
