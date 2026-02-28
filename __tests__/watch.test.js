import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseWatchArgs, colorize, findLatestLog } from "../src/watch.js";
describe("parseWatchArgs", () => {
    it("returns defaults with no args", () => {
        const opts = parseWatchArgs([]);
        expect(opts.dir).toContain(".ilya/logs");
        expect(opts.file).toBeNull();
        expect(opts.color).toBe(true);
    });
    it("parses --dir", () => {
        const opts = parseWatchArgs(["--dir", "/tmp/my-logs"]);
        expect(opts.dir).toBe("/tmp/my-logs");
    });
    it("parses --file", () => {
        const opts = parseWatchArgs(["--file", "/tmp/specific.log"]);
        expect(opts.file).toBe("/tmp/specific.log");
    });
    it("parses --no-color", () => {
        const opts = parseWatchArgs(["--no-color"]);
        expect(opts.color).toBe(false);
    });
    it("parses all flags together", () => {
        const opts = parseWatchArgs([
            "--dir",
            "/logs",
            "--file",
            "/logs/x.log",
            "--no-color",
        ]);
        expect(opts.dir).toBe("/logs");
        expect(opts.file).toBe("/logs/x.log");
        expect(opts.color).toBe(false);
    });
    it("ignores --dir without a following value", () => {
        const opts = parseWatchArgs(["--dir"]);
        expect(opts.dir).toContain(".ilya/logs");
    });
    it("ignores --file without a following value", () => {
        const opts = parseWatchArgs(["--file"]);
        expect(opts.file).toBeNull();
    });
});
describe("colorize", () => {
    it("returns line unchanged when color is disabled", () => {
        const line = "12:34:56.100 → CLIENT  notification  notifications/initialized";
        expect(colorize(line, false)).toBe(line);
    });
    it("dims timestamps", () => {
        const result = colorize("12:34:56.100 some text", true);
        expect(result).toContain("\x1b[2m12:34:56.100\x1b[0m");
    });
    it("colors → CLIENT cyan+bold", () => {
        const result = colorize("→ CLIENT", true);
        expect(result).toContain("\x1b[36m\x1b[1m→ CLIENT\x1b[0m");
    });
    it("colors ← SERVER green+bold", () => {
        const result = colorize("← SERVER", true);
        expect(result).toContain("\x1b[32m\x1b[1m← SERVER\x1b[0m");
    });
    it("colors ERROR red+bold", () => {
        const result = colorize("ERROR", true);
        expect(result).toContain("\x1b[31m\x1b[1mERROR\x1b[0m");
    });
    it("colors notification blue", () => {
        const result = colorize("notification", true);
        expect(result).toContain("\x1b[34mnotification\x1b[0m");
    });
    it("colors request white", () => {
        const result = colorize("request", true);
        expect(result).toContain("\x1b[37mrequest\x1b[0m");
    });
    it("colors response white", () => {
        const result = colorize("response", true);
        expect(result).toContain("\x1b[37mresponse\x1b[0m");
    });
    it("colors initialize methods magenta", () => {
        const result = colorize("initialize", true);
        expect(result).toContain("\x1b[35minitialize\x1b[0m");
    });
    it("colors tools/* methods green", () => {
        const result = colorize("tools/list", true);
        expect(result).toContain("\x1b[32mtools/list\x1b[0m");
    });
    it("colors resources/* methods cyan", () => {
        const result = colorize("resources/read", true);
        expect(result).toContain("\x1b[36mresources/read\x1b[0m");
    });
    it("colors prompts/* methods yellow", () => {
        const result = colorize("prompts/get", true);
        expect(result).toContain("\x1b[33mprompts/get\x1b[0m");
    });
    it("colors notifications/* methods blue", () => {
        const result = colorize("notifications/initialized", true);
        // notifications/ gets blue, then initialize* gets magenta from later regex
        expect(result).toContain("\x1b[34mnotifications/");
    });
    it("dims request IDs", () => {
        const result = colorize("#1", true);
        expect(result).toContain("\x1b[2m#1\x1b[0m");
    });
    it("dims elapsed time", () => {
        const result = colorize("50ms", true);
        expect(result).toContain("\x1b[2m50ms\x1b[0m");
    });
    it("dims indented content lines", () => {
        const result = colorize('    {"key":"value"}', true);
        expect(result.startsWith("\x1b[2m")).toBe(true);
        expect(result.endsWith("\x1b[0m")).toBe(true);
    });
    it("dims [server stderr] lines", () => {
        const result = colorize("[server stderr] Listening on stdio", true);
        expect(result.startsWith("\x1b[2m")).toBe(true);
        expect(result.endsWith("\x1b[0m")).toBe(true);
    });
    it("dims error detail lines (indented content takes precedence)", () => {
        const result = colorize("    [-32601] Method not found", true);
        // Indented dim check fires first, so the line is dimmed rather than red
        expect(result.startsWith("\x1b[2m")).toBe(true);
    });
    it("handles a full notification line", () => {
        const line = "12:34:56.100 → CLIENT  notification  notifications/initialized";
        const result = colorize(line, true);
        expect(result).toContain("\x1b[2m12:34:56.100\x1b[0m");
        expect(result).toContain("\x1b[36m\x1b[1m→ CLIENT\x1b[0m");
        expect(result).toContain("\x1b[34mnotification\x1b[0m");
        expect(result).toContain("\x1b[34mnotifications/");
    });
    it("handles a full request line", () => {
        const line = "12:34:56.200 → CLIENT  request  tools/list  #2";
        const result = colorize(line, true);
        expect(result).toContain("\x1b[37mrequest\x1b[0m");
        expect(result).toContain("\x1b[32mtools/list\x1b[0m");
        expect(result).toContain("\x1b[2m#2\x1b[0m");
    });
    it("handles a full response line", () => {
        const line = "12:34:56.250 ← SERVER  response  initialize  #1  50ms";
        const result = colorize(line, true);
        expect(result).toContain("\x1b[32m\x1b[1m← SERVER\x1b[0m");
        expect(result).toContain("\x1b[37mresponse\x1b[0m");
        expect(result).toContain("\x1b[35minitialize\x1b[0m");
        expect(result).toContain("\x1b[2m#1\x1b[0m");
        expect(result).toContain("\x1b[2m50ms\x1b[0m");
    });
    it("handles a full error line", () => {
        const line = "12:34:57.456 ← SERVER  ERROR  (tools/call #3)  12ms";
        const result = colorize(line, true);
        expect(result).toContain("\x1b[31m\x1b[1mERROR\x1b[0m");
        expect(result).toContain("\x1b[32mtools/call\x1b[0m");
    });
});
describe("findLatestLog", () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = join(tmpdir(), `ilya-test-${process.pid}-${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });
    });
    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });
    it("returns null for empty directory", () => {
        expect(findLatestLog(tmpDir)).toBeNull();
    });
    it("returns null for nonexistent directory", () => {
        expect(findLatestLog(join(tmpDir, "nope"))).toBeNull();
    });
    it("finds the only log file", () => {
        const logPath = join(tmpDir, "server-123.log");
        writeFileSync(logPath, "test\n");
        expect(findLatestLog(tmpDir)).toBe(logPath);
    });
    it("ignores non-.log files", () => {
        writeFileSync(join(tmpDir, "notes.txt"), "not a log\n");
        writeFileSync(join(tmpDir, "data.json"), "{}\n");
        expect(findLatestLog(tmpDir)).toBeNull();
    });
    it("returns the most recently modified log file", () => {
        const older = join(tmpDir, "old-111.log");
        const newer = join(tmpDir, "new-222.log");
        writeFileSync(older, "old\n");
        writeFileSync(newer, "new\n");
        // Force older mtime on the first file
        const past = new Date(Date.now() - 10000);
        utimesSync(older, past, past);
        expect(findLatestLog(tmpDir)).toBe(newer);
    });
    it("picks based on mtime not filename", () => {
        const a = join(tmpDir, "aaa-111.log");
        const z = join(tmpDir, "zzz-999.log");
        writeFileSync(a, "a\n");
        writeFileSync(z, "z\n");
        // Make z older
        const past = new Date(Date.now() - 10000);
        utimesSync(z, past, past);
        expect(findLatestLog(tmpDir)).toBe(a);
    });
});
