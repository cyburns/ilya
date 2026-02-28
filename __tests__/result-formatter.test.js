import { describe, it, expect, vi } from "vitest";
import { formatResult, } from "../src/result-formatter.js";
import { PLAIN } from "../src/colors.js";
function createMockCtx() {
    const written = [];
    const logger = {
        write: vi.fn((colored, plain) => {
            written.push({ colored, plain });
        }),
    };
    return {
        ctx: {
            logger,
            colors: PLAIN,
            plainColors: PLAIN,
        },
        written,
        logger,
    };
}
describe("formatResult", () => {
    it("does nothing for undefined result", () => {
        const { logger } = createMockCtx();
        formatResult("tools/list", undefined, undefined, {
            logger,
            colors: PLAIN,
            plainColors: PLAIN,
        });
        expect(logger.write).not.toHaveBeenCalled();
    });
    it("summarizes tools/list", () => {
        const { ctx, written } = createMockCtx();
        formatResult("tools/list", {
            tools: [{ name: "echo" }, { name: "add" }],
        }, undefined, ctx);
        expect(written.length).toBe(1);
        expect(written[0].plain).toContain("2 tools");
        expect(written[0].plain).toContain("echo, add");
    });
    it("truncates long tools/list", () => {
        const { ctx, written } = createMockCtx();
        const tools = Array.from({ length: 20 }, (_, i) => ({ name: `tool${i}` }));
        formatResult("tools/list", { tools }, undefined, ctx);
        expect(written[0].plain).toContain("20 tools");
        expect(written[0].plain).toContain("+14 more");
    });
    it("summarizes resources/list", () => {
        const { ctx, written } = createMockCtx();
        formatResult("resources/list", {
            resources: [{ name: "readme", uri: "file:///readme" }],
        }, undefined, ctx);
        expect(written[0].plain).toContain("1 resources");
        expect(written[0].plain).toContain("readme");
    });
    it("summarizes prompts/list", () => {
        const { ctx, written } = createMockCtx();
        formatResult("prompts/list", {
            prompts: [{ name: "greeting" }],
        }, undefined, ctx);
        expect(written[0].plain).toContain("1 prompts");
        expect(written[0].plain).toContain("greeting");
    });
    it("formats tools/call text content", () => {
        const { ctx, written } = createMockCtx();
        formatResult("tools/call", {
            content: [{ type: "text", text: "hello\nworld" }],
        }, undefined, ctx);
        expect(written.length).toBe(2);
        expect(written[0].plain).toContain("[text] hello");
        expect(written[1].plain).toContain("[text] world");
    });
    it("formats tools/call image content", () => {
        const { ctx, written } = createMockCtx();
        formatResult("tools/call", {
            content: [
                { type: "image", mimeType: "image/png", data: "a".repeat(4096) },
            ],
        }, undefined, ctx);
        expect(written[0].plain).toContain("[image image/png]");
        expect(written[0].plain).toContain("KB");
    });
    it("shows isError flag", () => {
        const { ctx, written } = createMockCtx();
        formatResult("tools/call", {
            content: [{ type: "text", text: "fail" }],
            isError: true,
        }, undefined, ctx);
        const last = written[written.length - 1];
        expect(last.plain).toContain("isError: true");
    });
    it("formats initialize capabilities", () => {
        const { ctx, written } = createMockCtx();
        formatResult("initialize", {
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: "test-server", version: "1.0" },
        }, undefined, ctx);
        expect(written[0].plain).toContain("test-server v1.0");
        expect(written[0].plain).toContain("tools, resources");
    });
    it("shows truncated JSON for unknown methods", () => {
        const { ctx, written } = createMockCtx();
        formatResult("unknown/method", { foo: "bar" }, undefined, ctx);
        expect(written[0].plain).toContain("foo");
    });
});
