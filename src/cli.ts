import { createColors, PLAIN } from "./colors.js";
import { Logger } from "./logger.js";
import { startHttpServer } from "./http-server.js";
import { startProxy } from "./proxy.js";
import type { PendingRequest } from "./result-formatter.js";

interface ParsedArgs {
  logFilePath: string | null;
  httpPort: number | null;
  serverCmd: string | null;
  serverArgs: string[];
}

/**
 * Print the usage information for the CLI.
 */
const printUsage = (): void => {
  process.stderr.write(`ilya — transparent MCP stdio proxy with logging

Usage:
  ilya [options] <command> [args...]

Options:
  --log, -l <path>    Write logs to a specific file
  --port, -p <port>   Start an HTTP server to stream logs
  --help, -h          Show this help
  --version, -v       Show version

Examples:
  ilya node ./my-server.js
  ilya --log /tmp/tap.log python server.py
  ilya --port 3456 npx ts-node ./server.ts
`);
};

/**
 * Parse command-line arguments into a structured format.
 * @param argv The command-line arguments to parse
 */
const parseArgs = (argv: string[]): ParsedArgs => {
  const args = argv.slice(2);
  let logFilePath: string | null = null;
  let httpPort: number | null = null;
  let serverCmd: string | null = null;
  let serverArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--log" || args[i] === "-l") && i + 1 < args.length) {
      logFilePath = args[++i];
    } else if (
      (args[i] === "--port" || args[i] === "-p") &&
      i + 1 < args.length
    ) {
      httpPort = parseInt(args[++i], 10);
    } else if (args[i] === "--help" || args[i] === "-h") {
      printUsage();
      process.exit(0);
    } else if (args[i] === "--version" || args[i] === "-v") {
      process.stderr.write("ilya 0.1.0\n");
      process.exit(0);
    } else {
      serverCmd = args[i];
      serverArgs = args.slice(i + 1);
      break;
    }
  }

  return { logFilePath, httpPort, serverCmd, serverArgs };
};

/**
 * Run the CLI application.
 */
export const run = (): void => {
  const { logFilePath, httpPort, serverCmd, serverArgs } = parseArgs(
    process.argv,
  );

  if (!serverCmd) {
    printUsage();
    process.exit(1);
    return; // unreachable, helps TS narrow
  }

  const isTTY = !!process.stderr.isTTY;
  const colors = createColors(isTTY);
  const logger = new Logger({ logFilePath, isTTY, serverCmd });
  const pendingRequests = new Map<string | number, PendingRequest>();

  if (httpPort) {
    startHttpServer(httpPort, logger, `${serverCmd} ${serverArgs.join(" ")}`);
  }

  startProxy({
    serverCmd,
    serverArgs,
    logger,
    colors,
    ctx: { logger, colors, plainColors: PLAIN, pendingRequests },
  });
};

run();
