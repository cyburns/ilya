import { describe, it, expect, vi } from "vitest";
import { formatMessage } from "../src/formatter.js";
import { PLAIN } from "../src/colors.js";
function createMockCtx() {
    const written = [];
    const pendingRequests = new Map();
    const logger = {
        write: vi.fn((colored, plain) => {
            written.push({ colored, plain });
        }),
    };
    const ctx = {
        logger: logger,
        colors: PLAIN,
        plainColors: PLAIN,
        pendingRequests,
    };
    return { ctx, written, pendingRequests };
}
describe("formatMessage", () => {
    it("formats a notification (method, no id)", () => {
        const { ctx, written } = createMockCtx();
        const json = JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized",
        });
        formatMessage(json, "client", ctx);
        expect(written[0].plain).toContain("CLIENT");
        expect(written[0].plain).toContain("notification");
        expect(written[0].plain).toContain("notifications/initialized");
    });
    it("formats a request (method + id)", () => {
        const { ctx, written, pendingRequests } = createMockCtx();
        const json = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
        });
        formatMessage(json, "client", ctx);
        expect(written[0].plain).toContain("request");
        expect(written[0].plain).toContain("tools/list");
        expect(written[0].plain).toContain("#1");
        expect(pendingRequests.has(1)).toBe(true);
    });
    it("formats a tools/call request with tool name", () => {
        const { ctx, written } = createMockCtx();
        const json = JSON.stringify({
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: { name: "echo", arguments: { msg: "hi" } },
        });
        formatMessage(json, "client", ctx);
        expect(written[0].plain).toContain("echo");
        expect(written[0].plain).toContain("#5");
        // arguments are printed on subsequent lines
        expect(written.length).toBeGreaterThan(1);
    });
    it("formats a success response", () => {
        const { ctx, written, pendingRequests } = createMockCtx();
        pendingRequests.set(1, {
            method: "tools/list",
            toolName: null,
            ts: Date.now() - 50,
        });
        const json = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [{ name: "echo" }] },
        });
        formatMessage(json, "server", ctx);
        expect(written[0].plain).toContain("response");
        expect(written[0].plain).toContain("tools/list");
        expect(pendingRequests.has(1)).toBe(false);
    });
    it("formats an error response", () => {
        const { ctx, written, pendingRequests } = createMockCtx();
        pendingRequests.set(2, {
            method: "tools/call",
            toolName: "fail",
            ts: Date.now(),
        });
        const json = JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            error: { code: -32600, message: "Invalid request" },
        });
        formatMessage(json, "server", ctx);
        expect(written[0].plain).toContain("ERROR");
        expect(written[1].plain).toContain("-32600");
        expect(written[1].plain).toContain("Invalid request");
    });
    it("handles invalid JSON gracefully", () => {
        const { ctx, written } = createMockCtx();
        formatMessage("not json at all", "client", ctx);
        expect(written[0].plain).toContain("[raw]");
        expect(written[0].plain).toContain("not json at all");
    });
    it("uses correct direction labels", () => {
        const { ctx, written } = createMockCtx();
        const json = JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/test",
        });
        formatMessage(json, "client", ctx);
        expect(written[0].plain).toContain("→");
        expect(written[0].plain).toContain("CLIENT");
        formatMessage(json, "server", ctx);
        expect(written[1].plain).toContain("←");
        expect(written[1].plain).toContain("SERVER");
    });
    it("shows notification params when present", () => {
        const { ctx, written } = createMockCtx();
        const json = JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/progress",
            params: { token: "abc", progress: 50 },
        });
        formatMessage(json, "server", ctx);
        expect(written.length).toBe(2);
        expect(written[1].plain).toContain("token");
    });
});
