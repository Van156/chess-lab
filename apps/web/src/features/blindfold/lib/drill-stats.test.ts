import { describe, expect, test } from "bun:test";

import { hasAnySessions, recentAccuracies, type DrillStat } from "./drill-stats";

const stat = (overrides: Partial<DrillStat> = {}): DrillStat => ({
  drill: "square_colour",
  sessions: 0,
  bestAccuracy: null,
  recent: [],
  ...overrides,
});

describe("recentAccuracies", () => {
  test("returns accuracies oldest first, from a newest-first list", () => {
    const recent = [
      { id: "c", correct: 20, total: 20, durationMs: 1 },
      { id: "b", correct: 15, total: 20, durationMs: 1 },
      { id: "a", correct: 10, total: 20, durationMs: 1 },
    ];
    expect(recentAccuracies(recent).map((point) => point.accuracy)).toEqual([0.5, 0.75, 1]);
    expect(recentAccuracies(recent).map((point) => point.id)).toEqual(["a", "b", "c"]);
  });

  test("is empty when nothing was played", () => {
    expect(recentAccuracies([])).toEqual([]);
  });
});

describe("hasAnySessions", () => {
  test("is false until some drill has a session", () => {
    expect(hasAnySessions([stat(), stat({ drill: "coordinates" })])).toBe(false);
    expect(hasAnySessions([stat(), stat({ drill: "coordinates", sessions: 2 })])).toBe(true);
    expect(hasAnySessions([])).toBe(false);
  });
});
