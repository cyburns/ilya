/**
 * Get the current timestamp in the format HH:MM:SS.mmm
 * @returns The current timestamp in the format HH:MM:SS.mmm
 */
export const timestamp = (): string => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
};

/**
 * Truncate a string to a maximum length, adding "..." if truncated.
 * @param str The string to truncate
 * @param max The maximum length of the string
 * @returns The truncated string
 */
export const truncate = (str: string, max = 200): string => {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
};
