import { describe, it, expect } from "vitest";
import { timestamp, truncate } from "../src/utils.js";

describe("timestamp", () => {
  it("returns HH:MM:SS.mmm format", () => {
    const ts = timestamp();
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 200)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    const long = "a".repeat(300);
    const result = truncate(long, 200);
    expect(result.length).toBe(200);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns string at exact max length unchanged", () => {
    const exact = "b".repeat(200);
    expect(truncate(exact, 200)).toBe(exact);
  });

  it("uses default max of 200", () => {
    const long = "c".repeat(250);
    const result = truncate(long);
    expect(result.length).toBe(200);
  });
});
