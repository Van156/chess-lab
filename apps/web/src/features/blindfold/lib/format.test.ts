import { describe, expect, test } from "bun:test";

import { formatDuration, formatPercent } from "./format";

describe("formatDuration", () => {
  test("shows minutes and zero-padded seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5_400)).toBe("0:05");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(600_000)).toBe("10:00");
  });

  test("treats negative values as zero", () => {
    expect(formatDuration(-10)).toBe("0:00");
  });
});

describe("formatPercent", () => {
  test("rounds a fraction to a whole percent", () => {
    expect(formatPercent(0.85)).toBe("85%");
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});
