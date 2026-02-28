import { describe, it, expect, vi } from "vitest";
import { createLineBuffer } from "./line-buffer.js";

describe("createLineBuffer", () => {
  it("emits complete lines", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed("hello\nworld\n");
    expect(lines).toEqual(["hello", "world"]);
  });

  it("buffers partial lines until newline arrives", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed("hel");
    expect(lines).toEqual([]);

    feed("lo\n");
    expect(lines).toEqual(["hello"]);
  });

  it("handles multiple chunks assembling one line", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed("a");
    feed("b");
    feed("c\n");
    expect(lines).toEqual(["abc"]);
  });

  it("skips empty lines", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed("one\n\n\ntwo\n");
    expect(lines).toEqual(["one", "two"]);
  });

  it("skips whitespace-only lines", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed("one\n   \ntwo\n");
    expect(lines).toEqual(["one", "two"]);
  });

  it("handles multiple messages in one chunk", () => {
    const lines: string[] = [];
    const feed = createLineBuffer((line) => lines.push(line));

    feed('{"a":1}\n{"b":2}\n{"c":3}\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });
});
