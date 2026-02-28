export interface Colors {
  RESET: string;
  BOLD: string;
  DIM: string;
  RED: string;
  GREEN: string;
  YELLOW: string;
  BLUE: string;
  MAGENTA: string;
  CYAN: string;
  WHITE: string;
}

/**
 * Create a Colors object with ANSI escape codes if the terminal supports it.
 *
 * @param isTTY Whether the output is a TTY (supports colors)
 * @returns A Colors object with appropriate escape codes or empty strings
 */
export const createColors = (isTTY: boolean): Colors => {
  if (isTTY) {
    return {
      RESET: "\x1b[0m",
      BOLD: "\x1b[1m",
      DIM: "\x1b[2m",
      RED: "\x1b[31m",
      GREEN: "\x1b[32m",
      YELLOW: "\x1b[33m",
      BLUE: "\x1b[34m",
      MAGENTA: "\x1b[35m",
      CYAN: "\x1b[36m",
      WHITE: "\x1b[37m",
    };
  }

  return {
    RESET: "",
    BOLD: "",
    DIM: "",
    RED: "",
    GREEN: "",
    YELLOW: "",
    BLUE: "",
    MAGENTA: "",
    CYAN: "",
    WHITE: "",
  };
};

export const PLAIN: Colors = {
  RESET: "",
  BOLD: "",
  DIM: "",
  RED: "",
  GREEN: "",
  YELLOW: "",
  BLUE: "",
  MAGENTA: "",
  CYAN: "",
  WHITE: "",
};

/**
 * Get the color for a given method name.
 *
 * @param method The method name
 * @param colors The Colors object to use
 * @returns The color string for the method
 */
export const methodColor = (
  method: string | undefined,
  colors: Colors,
): string => {
  if (!method) return colors.WHITE;
  if (method.startsWith("initialize")) return colors.MAGENTA;
  if (method.startsWith("tools/")) return colors.GREEN;
  if (method.startsWith("resources/")) return colors.CYAN;
  if (method.startsWith("prompts/")) return colors.YELLOW;
  if (method.startsWith("notifications/")) return colors.BLUE;
  return colors.WHITE;
};
