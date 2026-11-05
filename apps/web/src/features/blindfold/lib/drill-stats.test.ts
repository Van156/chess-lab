import { describe, expect, test } from "bun:test";

import { DRILL_CATALOG } from "./drill-catalog";
import {
  bestAccuracyFor,
  groupDrillsByCategory,
  hasAnySessions,
  recentAccuracies,
  totals,
  trendSummary,
  type DrillStat,
} from "./drill-stats";

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

describe("bestAccuracyFor", () => {
  test("reads one drill's best, null when unknown or unplayed", () => {
    const stats = [stat({ sessions: 3, bestAccuracy: 0.9 }), stat({ drill: "coordinates" })];
    expect(bestAccuracyFor(stats, "square_colour")).toBe(0.9);
    expect(bestAccuracyFor(stats, "coordinates")).toBeNull();
    expect(bestAccuracyFor(stats, "mate_in_one")).toBeNull();
  });
});

describe("groupDrillsByCategory", () => {
  test("keeps catalogue order inside each category", () => {
    const groups = groupDrillsByCategory(DRILL_CATALOG);
    expect(groups.map((group) => group.category.id)).toEqual(["geometry", "vision", "memory"]);
    expect(groups.flatMap((group) => group.drills).length).toBe(DRILL_CATALOG.length);
    expect(groups[0]!.drills.map((drill) => drill.kind)).toEqual([
      "square_colour",
      "coordinates",
      "diagonals",
      "same_diagonal",
    ]);
  });

  test("drops categories with no drills", () => {
    const groups = groupDrillsByCategory(DRILL_CATALOG.filter((d) => d.category === "memory"));
    expect(groups.map((group) => group.category.id)).toEqual(["memory"]);
  });
});

describe("totals", () => {
  test("adds sessions and counts drills played", () => {
    expect(totals([stat({ sessions: 3 }), stat({ sessions: 0 }), stat({ sessions: 2 })])).toEqual({
      sessions: 5,
      drillsPlayed: 2,
    });
  });
});

describe("trendSummary", () => {
  test("lists values oldest first with the overall change", () => {
    expect(trendSummary([{ accuracy: 0.6 }, { accuracy: 0.95 }])).toBe(
      "Last 2 sessions, oldest first: 60%, 95%; up 35 points.",
    );
    expect(trendSummary([{ accuracy: 0.9 }, { accuracy: 0.8 }])).toBe(
      "Last 2 sessions, oldest first: 90%, 80%; down 10 points.",
    );
    expect(trendSummary([{ accuracy: 0.5 }, { accuracy: 0.5 }])).toContain("level");
  });

  test("handles one or no sessions", () => {
    expect(trendSummary([{ accuracy: 0.55 }])).toBe("Last session: 55%.");
    expect(trendSummary([])).toBe("No recent sessions.");
  });
});
