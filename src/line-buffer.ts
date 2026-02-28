/**
 * Create a line buffer that calls a callback for each complete line.
 *
 * @param onLine The callback to call for each complete line
 * @returns A function that can be called with chunks of text
 */
export const createLineBuffer = (
  onLine: (line: string) => void,
): ((chunk: string) => void) => {
  let buffer = "";

  return (chunk: string) => {
    buffer += chunk;
    let newlineIdx: number;

    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.trim().length > 0) {
        onLine(line);
      }
    }
  };
};
