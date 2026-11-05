import { describe, expect, test } from "bun:test";

import {
  accuracy,
  averageMsPerQuestion,
  isPersonalBest,
  longestRun,
  summariseSession,
  verdictFor,
} from "./score";

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

describe("verdictFor", () => {
  test("names a tier for each accuracy band", () => {
    expect(verdictFor(1).label).toBe("Flawless");
    expect(verdictFor(0.95).label).toBe("Sharp");
    expect(verdictFor(18 / 20).label).toBe("Sharp");
    expect(verdictFor(0.89).label).toBe("Solid");
    expect(verdictFor(0.75).label).toBe("Solid");
    expect(verdictFor(0.74).label).toBe("Building");
    expect(verdictFor(0.5).label).toBe("Building");
    expect(verdictFor(0.49).label).toBe("Warm-up");
    expect(verdictFor(0).tier).toBe("warm_up");
  });

  test("always carries a short message", () => {
    for (const fraction of [0, 0.5, 0.75, 0.9, 1]) {
      expect(verdictFor(fraction).message.length).toBeGreaterThan(0);
    }
  });
});

describe("isPersonalBest", () => {
  test("is true only when an earlier best is beaten", () => {
    expect(isPersonalBest(0.9, 0.85)).toBe(true);
    expect(isPersonalBest(0.85, 0.85)).toBe(false);
    expect(isPersonalBest(0.5, 0.85)).toBe(false);
  });

  test("is false without an earlier best", () => {
    expect(isPersonalBest(1, null)).toBe(false);
    expect(isPersonalBest(1, undefined)).toBe(false);
  });
});

describe("longestRun", () => {
  test("finds the longest run of correct answers", () => {
    expect(longestRun([true, true, false, true, true, true, false])).toBe(3);
    expect(longestRun([false, false])).toBe(0);
    expect(longestRun([])).toBe(0);
  });
});

describe("averageMsPerQuestion", () => {
  test("divides the time by the questions, 0 when there are none", () => {
    expect(averageMsPerQuestion({ total: 20, durationMs: 83_000 })).toBe(4150);
    expect(averageMsPerQuestion({ total: 0, durationMs: 5_000 })).toBe(0);
  });
});
