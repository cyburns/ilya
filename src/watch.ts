import { readdirSync, statSync, mkdirSync, openSync, readSync, fstatSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_LOG_DIR = join(homedir(), ".ilya", "logs");
const POLL_MS = 200;
const SWITCH_CHECK_MS = 2000;

interface WatchOptions {
  dir: string;
  file: string | null;
  color: boolean;
}

export const parseWatchArgs = (args: string[]): WatchOptions => {
  let dir = DEFAULT_LOG_DIR;
  let file: string | null = null;
  let color = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && i + 1 < args.length) {
      dir = args[++i];
    } else if (args[i] === "--file" && i + 1 < args.length) {
      file = args[++i];
    } else if (args[i] === "--no-color") {
      color = false;
    } else if (args[i] === "--help" || args[i] === "-h") {
      printWatchUsage();
      process.exit(0);
    }
  }

  return { dir, file, color };
};

const printWatchUsage = (): void => {
  process.stderr.write(`ilya watch — stream MCP logs with colors

Usage:
  ilya watch [options]

Options:
  --dir <path>     Custom log directory (default: ~/.ilya/logs/)
  --file <path>    Watch a specific file instead of auto-detecting
  --no-color       Disable colors
  --help, -h       Show this help
`);
};

export const colorize = (line: string, useColor: boolean): string => {
  if (!useColor) return line;

  // Timestamp at start of line (HH:MM:SS.mmm)
  line = line.replace(/^(\d{2}:\d{2}:\d{2}\.\d{3})/, "\x1b[2m$1\x1b[0m");

  // Direction + label
  line = line.replace(/→ CLIENT/g, "\x1b[36m\x1b[1m→ CLIENT\x1b[0m");
  line = line.replace(/← SERVER/g, "\x1b[32m\x1b[1m← SERVER\x1b[0m");

  // Message types
  line = line.replace(/\bERROR\b/g, "\x1b[31m\x1b[1mERROR\x1b[0m");
  line = line.replace(/\bnotification\b/, "\x1b[34mnotification\x1b[0m");
  line = line.replace(/\brequest\b/, "\x1b[37mrequest\x1b[0m");
  line = line.replace(/\bresponse\b/, "\x1b[37mresponse\x1b[0m");

  // Method names — order matters (more specific first)
  line = line.replace(/\binitialize\w*/g, "\x1b[35m$&\x1b[0m");
  line = line.replace(/\btools\/\S+/g, "\x1b[32m$&\x1b[0m");
  line = line.replace(/\bresources\/\S+/g, "\x1b[36m$&\x1b[0m");
  line = line.replace(/\bprompts\/\S+/g, "\x1b[33m$&\x1b[0m");
  line = line.replace(/\bnotifications\/\S+/g, "\x1b[34m$&\x1b[0m");

  // Request IDs — dim
  line = line.replace(/(#\d+)/g, "\x1b[2m$1\x1b[0m");

  // Elapsed time — dim
  line = line.replace(/(\d+ms)/g, "\x1b[2m$1\x1b[0m");

  // Indented content lines (JSON args, result details) — dim
  if (line.startsWith("    ")) {
    line = "\x1b[2m" + line + "\x1b[0m";
  }

  // Server stderr lines — dim
  if (line.startsWith("[server stderr]")) {
    line = "\x1b[2m" + line + "\x1b[0m";
  }

  // Error detail lines like "    [-32601] Method not found" — red
  if (/^\s+\[[-\d]+\]/.test(line)) {
    line = "\x1b[31m" + line + "\x1b[0m";
  }

  return line;
};

export const findLatestLog = (dir: string): string | null => {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  let latest: string | null = null;
  let latestMtime = 0;

  for (const entry of entries) {
    if (!entry.endsWith(".log")) continue;
    try {
      const fullPath = join(dir, entry);
      const st = statSync(fullPath);
      if (st.mtimeMs > latestMtime) {
        latestMtime = st.mtimeMs;
        latest = fullPath;
      }
    } catch {
      // file may have been deleted
    }
  }

  return latest;
};

const ensureDir = (dir: string): void => {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
};

export const watch = (opts: WatchOptions): void => {
  const { dir, file: specificFile, color } = opts;

  ensureDir(dir);

  if (specificFile) {
    streamFile(specificFile, color);
    return;
  }

  // Find latest log or wait for one
  let logFile = findLatestLog(dir);

  if (!logFile) {
    process.stdout.write(`Waiting for ilya logs in ${dir} ...\n`);
    const waitInterval = setInterval(() => {
      logFile = findLatestLog(dir);
      if (logFile) {
        clearInterval(waitInterval);
        process.stdout.write(`\n`);
        streamFile(logFile, color, dir);
      }
    }, 1000);
    return;
  }

  streamFile(logFile, color, dir);
};

const streamFile = (
  filePath: string,
  useColor: boolean,
  autoSwitchDir?: string,
): void => {
  const fileName = filePath.split("/").pop() || filePath;
  process.stdout.write(
    useColor
      ? `\x1b[2m--- watching ${fileName} ---\x1b[0m\n`
      : `--- watching ${fileName} ---\n`,
  );

  let fd: number;
  try {
    fd = openSync(filePath, "r");
  } catch {
    process.stderr.write(`Error: cannot open ${filePath}\n`);
    process.exit(1);
    return;
  }

  let offset = 0;
  let partial = "";

  // Print existing content
  const initialSize = fstatSync(fd).size;
  if (initialSize > 0) {
    const buf = Buffer.alloc(initialSize);
    readSync(fd, buf, 0, initialSize, 0);
    const text = buf.toString("utf-8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      // Last element may be empty string from trailing newline
      if (i === lines.length - 1 && lines[i] === "") continue;
      // Last element without trailing newline is a partial line
      if (i === lines.length - 1 && !text.endsWith("\n")) {
        partial = lines[i];
        continue;
      }
      process.stdout.write(colorize(lines[i], useColor) + "\n");
    }
    offset = initialSize;
  }

  // Poll for new content
  const readBuf = Buffer.alloc(65536);

  const pollInterval = setInterval(() => {
    let currentSize: number;
    try {
      currentSize = fstatSync(fd).size;
    } catch {
      // File was deleted
      clearInterval(pollInterval);
      if (switchCheckInterval) clearInterval(switchCheckInterval);
      closeSync(fd);
      if (autoSwitchDir) {
        handleFileGone(autoSwitchDir, useColor);
      }
      return;
    }

    if (currentSize <= offset) return;

    const toRead = Math.min(currentSize - offset, readBuf.length);
    const bytesRead = readSync(fd, readBuf, 0, toRead, offset);
    if (bytesRead === 0) return;

    offset += bytesRead;
    const text = partial + readBuf.subarray(0, bytesRead).toString("utf-8");
    partial = "";

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (i === lines.length - 1) {
        // Last chunk — may be partial
        if (lines[i] !== "") {
          partial = lines[i];
        }
        continue;
      }
      process.stdout.write(colorize(lines[i], useColor) + "\n");
    }
  }, POLL_MS);

  // Auto-switch check
  let switchCheckInterval: ReturnType<typeof setInterval> | null = null;

  if (autoSwitchDir) {
    switchCheckInterval = setInterval(() => {
      const newest = findLatestLog(autoSwitchDir);
      if (newest && newest !== filePath) {
        // A newer file appeared — switch to it
        clearInterval(pollInterval);
        clearInterval(switchCheckInterval!);

        // Flush any remaining partial
        if (partial) {
          process.stdout.write(colorize(partial, useColor) + "\n");
          partial = "";
        }

        closeSync(fd);
        process.stdout.write("\n");
        streamFile(newest, useColor, autoSwitchDir);
      }
    }, SWITCH_CHECK_MS);
  }

  // Clean exit
  const cleanup = (): void => {
    clearInterval(pollInterval);
    if (switchCheckInterval) clearInterval(switchCheckInterval);
    try {
      closeSync(fd);
    } catch {
      /* already closed */
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
};

const handleFileGone = (dir: string, useColor: boolean): void => {
  const next = findLatestLog(dir);
  if (next) {
    process.stdout.write("\n");
    streamFile(next, useColor, dir);
  } else {
    process.stdout.write(`\nLog file removed. Waiting for new logs in ${dir} ...\n`);
    const waitInterval = setInterval(() => {
      const found = findLatestLog(dir);
      if (found) {
        clearInterval(waitInterval);
        process.stdout.write("\n");
        streamFile(found, useColor, dir);
      }
    }, 1000);
  }
};
