import { describe, it, expect, vi } from "vitest";
import {
  formatResult,
  truncateArrays,
  truncateStringValues,
  removeNoiseFields,
  tryFormatJson,
  type FormatterContext,
} from "../src/result-formatter.js";
import { PLAIN } from "../src/colors.js";

function createMockCtx() {
  const written: Array<{ colored: string; plain: string }> = [];
  const logger = {
    write: vi.fn((colored: string, plain: string) => {
      written.push({ colored, plain });
    }),
  };
  return {
    ctx: {
      logger,
      colors: PLAIN,
      plainColors: PLAIN,
    } as unknown as FormatterContext,
    written,
    logger,
  };
}

describe("truncateArrays", () => {
  it("passes through non-arrays unchanged", () => {
    expect(truncateArrays("hello")).toBe("hello");
    expect(truncateArrays(42)).toBe(42);
    expect(truncateArrays(null)).toBe(null);
  });

  it("keeps arrays with <= maxItems intact", () => {
    expect(truncateArrays([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("truncates arrays with > maxItems", () => {
    expect(truncateArrays([1, 2, 3, 4, 5])).toEqual([1, 2, 3, "... +2 more"]);
  });

  it("truncates nested arrays", () => {
    const input = { items: [1, 2, 3, 4, 5] };
    const result = truncateArrays(input) as Record<string, unknown>;
    expect(result.items).toEqual([1, 2, 3, "... +2 more"]);
  });

  it("uses custom maxItems", () => {
    expect(truncateArrays([1, 2, 3, 4, 5], 2)).toEqual([1, 2, "... +3 more"]);
  });

  it("recursively truncates objects inside arrays", () => {
    const input = [
      { nested: [1, 2, 3, 4, 5] },
      { nested: [10, 20] },
      { nested: [100] },
      { nested: [1000] },
    ];
    const result = truncateArrays(input) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(4); // 3 items + marker
    expect(result[0].nested).toEqual([1, 2, 3, "... +2 more"]);
    expect(result[3]).toBe("... +1 more");
  });
});

describe("truncateStringValues", () => {
  it("passes through short strings", () => {
    expect(truncateStringValues("short")).toBe("short");
  });

  it("truncates long strings", () => {
    const long = "a".repeat(150);
    const result = truncateStringValues(long) as string;
    expect(result.length).toBe(100);
    expect(result).toMatch(/\.\.\.$/);
  });

  it("truncates strings inside objects", () => {
    const input = { msg: "a".repeat(150) };
    const result = truncateStringValues(input) as Record<string, unknown>;
    expect((result.msg as string).length).toBe(100);
  });

  it("truncates strings inside arrays", () => {
    const input = ["a".repeat(150)];
    const result = truncateStringValues(input) as string[];
    expect(result[0].length).toBe(100);
  });

  it("passes through non-strings", () => {
    expect(truncateStringValues(42)).toBe(42);
    expect(truncateStringValues(null)).toBe(null);
    expect(truncateStringValues(true)).toBe(true);
  });
});

describe("removeNoiseFields", () => {
  it("keeps all fields at top level", () => {
    const input = { id: "123", name: "test", timestamp: "2024-01-01" };
    expect(removeNoiseFields(input)).toEqual(input);
  });

  it("removes id and timestamp from array items", () => {
    const input = [
      { id: "1", name: "first", timestamp: "2024-01-01" },
      { id: "2", name: "second", timestamp: "2024-01-02" },
    ];
    const result = removeNoiseFields(input) as Array<Record<string, unknown>>;
    expect(result[0]).toEqual({ name: "first" });
    expect(result[1]).toEqual({ name: "second" });
  });

  it("removes empty graphql objects from array items", () => {
    const input = [{ name: "req", graphql: {} }];
    const result = removeNoiseFields(input) as Array<Record<string, unknown>>;
    expect(result[0]).toEqual({ name: "req" });
  });

  it("keeps non-empty graphql from array items", () => {
    const input = [{ name: "req", graphql: { query: "{ users }" } }];
    const result = removeNoiseFields(input) as Array<Record<string, unknown>>;
    expect(result[0].graphql).toEqual({ query: "{ users }" });
  });

  it("does not recurse noise-removal into nested non-array objects", () => {
    const input = { data: { id: "keep-me", items: [{ id: "remove-me" }] } };
    const result = removeNoiseFields(input) as Record<string, unknown>;
    const data = result.data as Record<string, unknown>;
    expect(data.id).toBe("keep-me");
    const items = data.items as Array<Record<string, unknown>>;
    expect(items[0].id).toBeUndefined();
  });
});

describe("tryFormatJson", () => {
  it("returns formatted JSON for valid JSON objects", () => {
    const result = tryFormatJson('{"a":1}');
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it("returns null for non-JSON text", () => {
    expect(tryFormatJson("hello world")).toBeNull();
  });

  it("returns null for JSON primitives", () => {
    expect(tryFormatJson("42")).toBeNull();
    expect(tryFormatJson('"string"')).toBeNull();
    expect(tryFormatJson("true")).toBeNull();
    expect(tryFormatJson("null")).toBeNull();
  });

  it("applies array truncation", () => {
    const input = JSON.stringify({ items: [1, 2, 3, 4, 5] });
    const result = tryFormatJson(input)!;
    expect(result).toContain("... +2 more");
  });

  it("applies noise field removal in arrays", () => {
    const input = JSON.stringify({
      requests: [{ id: "1", method: "GET" }],
    });
    const result = tryFormatJson(input)!;
    expect(result).not.toContain('"id"');
    expect(result).toContain('"method"');
  });

  it("applies string truncation", () => {
    const input = JSON.stringify({ msg: "x".repeat(200) });
    const result = tryFormatJson(input)!;
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(250);
  });
});

describe("formatResult", () => {
  it("does nothing for undefined result", () => {
    const { logger } = createMockCtx();
    formatResult("tools/list", undefined, undefined, {
      logger,
      colors: PLAIN,
      plainColors: PLAIN,
    } as unknown as FormatterContext);
    expect(logger.write).not.toHaveBeenCalled();
  });

  it("summarizes tools/list", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "tools/list",
      {
        tools: [{ name: "echo" }, { name: "add" }],
      },
      undefined,
      ctx,
    );
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
    formatResult(
      "resources/list",
      {
        resources: [{ name: "readme", uri: "file:///readme" }],
      },
      undefined,
      ctx,
    );
    expect(written[0].plain).toContain("1 resources");
    expect(written[0].plain).toContain("readme");
  });

  it("summarizes prompts/list", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "prompts/list",
      {
        prompts: [{ name: "greeting" }],
      },
      undefined,
      ctx,
    );
    expect(written[0].plain).toContain("1 prompts");
    expect(written[0].plain).toContain("greeting");
  });

  it("formats tools/call plain text content as before", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "tools/call",
      {
        content: [{ type: "text", text: "hello\nworld" }],
      },
      undefined,
      ctx,
    );
    expect(written.length).toBe(2);
    expect(written[0].plain).toContain("[text] hello");
    expect(written[1].plain).toContain("[text] world");
  });

  it("pretty-prints JSON text content", () => {
    const { ctx, written } = createMockCtx();
    const jsonText = JSON.stringify({ total: 5, name: "test" });
    formatResult(
      "tools/call",
      {
        content: [{ type: "text", text: jsonText }],
      },
      undefined,
      ctx,
    );
    // First line is the [text] label
    expect(written[0].plain).toBe("    [text]");
    // Subsequent lines are indented JSON: {, "total": 5, "name": "test", }
    const allPlain = written.map((w) => w.plain).join("\n");
    expect(allPlain).toContain('"total": 5');
    expect(allPlain).toContain('"name": "test"');
  });

  it("truncates arrays in JSON text content", () => {
    const { ctx, written } = createMockCtx();
    const jsonText = JSON.stringify({ items: [1, 2, 3, 4, 5, 6, 7] });
    formatResult(
      "tools/call",
      {
        content: [{ type: "text", text: jsonText }],
      },
      undefined,
      ctx,
    );
    const allPlain = written.map((w) => w.plain).join("\n");
    expect(allPlain).toContain("... +4 more");
  });

  it("formats tools/call image content", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "tools/call",
      {
        content: [
          { type: "image", mimeType: "image/png", data: "a".repeat(4096) },
        ],
      },
      undefined,
      ctx,
    );
    expect(written[0].plain).toContain("[image image/png]");
    expect(written[0].plain).toContain("KB");
  });

  it("shows isError flag", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "tools/call",
      {
        content: [{ type: "text", text: "fail" }],
        isError: true,
      },
      undefined,
      ctx,
    );
    const last = written[written.length - 1];
    expect(last.plain).toContain("isError: true");
  });

  it("formats initialize capabilities", () => {
    const { ctx, written } = createMockCtx();
    formatResult(
      "initialize",
      {
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "test-server", version: "1.0" },
      },
      undefined,
      ctx,
    );
    expect(written[0].plain).toContain("test-server v1.0");
    expect(written[0].plain).toContain("tools, resources");
  });

  it("shows truncated JSON for unknown methods", () => {
    const { ctx, written } = createMockCtx();
    formatResult("unknown/method", { foo: "bar" }, undefined, ctx);
    expect(written[0].plain).toContain("foo");
  });
});
