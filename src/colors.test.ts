import { describe, it, expect } from "vitest";
import { createColors, PLAIN, methodColor } from "./colors.js";

describe("createColors", () => {
  it("returns ANSI codes when isTTY is true", () => {
    const c = createColors(true);
    expect(c.RESET).toBe("\x1b[0m");
    expect(c.RED).toBe("\x1b[31m");
    expect(c.BOLD).toBe("\x1b[1m");
  });

  it("returns empty strings when isTTY is false", () => {
    const c = createColors(false);
    expect(c.RESET).toBe("");
    expect(c.RED).toBe("");
    expect(c.BOLD).toBe("");
  });
});

describe("PLAIN", () => {
  it("has all empty strings", () => {
    for (const val of Object.values(PLAIN)) {
      expect(val).toBe("");
    }
  });
});

describe("methodColor", () => {
  const c = createColors(true);

  it("returns MAGENTA for initialize", () => {
    expect(methodColor("initialize", c)).toBe(c.MAGENTA);
  });

  it("returns GREEN for tools/*", () => {
    expect(methodColor("tools/list", c)).toBe(c.GREEN);
    expect(methodColor("tools/call", c)).toBe(c.GREEN);
  });

  it("returns CYAN for resources/*", () => {
    expect(methodColor("resources/list", c)).toBe(c.CYAN);
  });

  it("returns YELLOW for prompts/*", () => {
    expect(methodColor("prompts/list", c)).toBe(c.YELLOW);
  });

  it("returns BLUE for notifications/*", () => {
    expect(methodColor("notifications/initialized", c)).toBe(c.BLUE);
  });

  it("returns WHITE for unknown methods", () => {
    expect(methodColor("something/else", c)).toBe(c.WHITE);
  });

  it("returns WHITE for undefined", () => {
    expect(methodColor(undefined, c)).toBe(c.WHITE);
  });
});
