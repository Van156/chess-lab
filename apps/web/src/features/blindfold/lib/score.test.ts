import { describe, expect, test } from "bun:test";

import { accuracy, summariseSession } from "./score";

describe("accuracy", () => {
  test("is the fraction of correct answers", () => {
    expect(accuracy({ correct: 15, total: 20 })).toBe(0.75);
    expect(accuracy({ correct: 20, total: 20 })).toBe(1);
  });

  test("is 0 when nothing was answered", () => {
    expect(accuracy({ correct: 0, total: 0 })).toBe(0);
  });
});

describe("summariseSession", () => {
  test("counts correct answers and keeps the duration", () => {
    expect(summariseSession([true, false, true, true], 12_345)).toEqual({
      correct: 3,
      total: 4,
      durationMs: 12_345,
    });
  });

  test("clamps a negative duration to 0 and rounds to whole milliseconds", () => {
    expect(summariseSession([true], -5).durationMs).toBe(0);
    expect(summariseSession([true], 10.6).durationMs).toBe(11);
  });
});
