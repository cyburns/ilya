import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type { ServerResponse } from "node:http";

export class Logger {
  private fileStream: WriteStream;
  private httpClients = new Set<ServerResponse>();
  private isTTY: boolean;
  readonly logFilePath: string;

  constructor(opts: {
    logFilePath?: string | null;
    isTTY: boolean;
    serverCmd: string;
  }) {
    this.isTTY = opts.isTTY;

    if (opts.logFilePath) {
      this.logFilePath = opts.logFilePath;
    } else {
      const serverName = basename(opts.serverCmd).replace(/\.[^.]+$/, "");
      const logDir = join(homedir(), ".mcp-tap", "logs");
      try {
        mkdirSync(logDir, { recursive: true });
      } catch {
        /* ignore */
      }
      this.logFilePath = join(logDir, `${serverName}-${process.pid}.log`);
    }

    this.fileStream = createWriteStream(this.logFilePath, { flags: "a" });
    process.stderr.write(`[mcp-tap] logging to ${this.logFilePath}\n`);
  }

  write(coloredLine: string, plainLine: string): void {
    if (this.isTTY) {
      process.stderr.write(coloredLine + "\n");
    }

    this.fileStream.write(plainLine + "\n");

    for (const res of this.httpClients) {
      try {
        res.write(plainLine + "\n");
      } catch {
        this.httpClients.delete(res);
      }
    }
  }

  addHttpClient(res: ServerResponse): void {
    this.httpClients.add(res);
  }

  removeHttpClient(res: ServerResponse): void {
    this.httpClients.delete(res);
  }

  close(): void {
    this.fileStream.end();
  }
}
