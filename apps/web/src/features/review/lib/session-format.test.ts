import { describe, expect, test } from "bun:test";

import { formatSessionTime } from "./session-format";

describe("formatSessionTime", () => {
  test.each([
    [0, "0 s"],
    [45_000, "45 s"],
    [180_000, "3 min"],
    [3_900_000, "1 h 5 min"],
    [7_200_000, "2 h"],
    [-5, "0 s"],
  ])("%i ms is %s", (ms, text) => {
    expect(formatSessionTime(ms)).toBe(text);
  });
});
