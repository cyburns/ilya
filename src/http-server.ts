import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Logger } from "./logger.js";

/**
 * Start an HTTP server to stream logs.
 *
 * @param port The port to listen on
 * @param logger The logger to stream logs from
 * @param serverDescription A description of the server being logged
 */
export const startHttpServer = (
  port: number,
  logger: Logger,
  serverDescription: string,
): void => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`[mcp-tap] streaming logs for: ${serverDescription}\n\n`);
    logger.addHttpClient(res);
    req.on("close", () => logger.removeHttpClient(res));
  });

  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `[mcp-tap] log server listening on http://127.0.0.1:${port}\n`,
    );
  });

  server.on("error", (err: Error) => {
    process.stderr.write(
      `[mcp-tap] failed to start HTTP server: ${err.message}\n`,
    );
  });
};
