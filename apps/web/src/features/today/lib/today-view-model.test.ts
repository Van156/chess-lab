import { describe, expect, test } from "bun:test";

import {
  describeSync,
  dueParts,
  formatDuration,
  streakMessage,
  todayMode,
} from "./today-view-model";
import type { SyncStatus, TodaySummary } from "./today-types";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const minutes = (count: number) => new Date(NOW + count * 60_000);

const idle: SyncStatus = {
  state: "idle",
  lastSyncedAt: minutes(-5),
  retryAt: null,
  gamesImported: 20,
};

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    due: { mistakes: 3 },
    dueTotal: 3,
    newBudgetLeft: 5,
    streak: { days: 2, reviewedToday: true },
    sync: idle,
    ...overrides,
  };
}

describe("todayMode", () => {
  test("is onboarding when nothing was ever imported", () => {
    const sync: SyncStatus = { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 };
    expect(todayMode(summary({ sync, dueTotal: 0, newBudgetLeft: 0 }))).toBe("onboarding");
  });

  test("is not onboarding once a sync finished, even with zero games", () => {
    const sync: SyncStatus = { ...idle, gamesImported: 0 };
    expect(todayMode(summary({ sync, dueTotal: 0, newBudgetLeft: 0 }))).toBe("caught-up");
  });

  test("is due while cards are due", () => {
    expect(todayMode(summary({ dueTotal: 4, newBudgetLeft: 0 }))).toBe("due");
  });

  test("is due while only the new-card allowance is left", () => {
    expect(todayMode(summary({ dueTotal: 0, newBudgetLeft: 2 }))).toBe("due");
  });

  test("is caught up with nothing due and no new cards allowed", () => {
    expect(todayMode(summary({ dueTotal: 0, newBudgetLeft: 0 }))).toBe("caught-up");
  });
});

describe("dueParts", () => {
  test("lists pillars with a positive count under their label", () => {
    expect(dueParts({ mistakes: 3 })).toEqual([{ key: "mistakes", label: "Mistakes", count: 3 }]);
  });

  test("drops zero and missing counts", () => {
    expect(dueParts({ mistakes: 0 })).toEqual([]);
    expect(dueParts({})).toEqual([]);
  });
});

describe("streakMessage", () => {
  test("no streak yet", () => {
    expect(streakMessage({ days: 0, reviewedToday: false })).toBe("No streak yet");
  });

  test("streak kept today", () => {
    expect(streakMessage({ days: 4, reviewedToday: true })).toBe("4-day streak");
  });

  test("streak alive through yesterday asks for a review today", () => {
    expect(streakMessage({ days: 4, reviewedToday: false })).toBe(
      "4-day streak, review today to keep it",
    );
  });

  test("a one day streak reads naturally", () => {
    expect(streakMessage({ days: 1, reviewedToday: true })).toBe("1-day streak");
  });
});

describe("formatDuration", () => {
  test("rounds to the largest whole unit", () => {
    expect(formatDuration(30_000)).toBe("less than a minute");
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(3 * 3_600_000 + 20 * 60_000)).toBe("3 h");
    expect(formatDuration(2 * 86_400_000 + 3_600_000)).toBe("2 d");
  });
});

describe("describeSync", () => {
  test("idle after a sync shows when it last ran and offers Sync now", () => {
    expect(describeSync(idle, NOW)).toEqual({
      tone: "neutral",
      message: "Last synced 5 min ago",
      canSync: true,
    });
  });

  test("idle without a sync yet", () => {
    const never: SyncStatus = { ...idle, lastSyncedAt: null };
    expect(describeSync(never, NOW)).toEqual({
      tone: "neutral",
      message: "Not synced yet",
      canSync: true,
    });
  });

  test("running blocks Sync now", () => {
    expect(describeSync({ ...idle, state: "running" }, NOW)).toEqual({
      tone: "progress",
      message: "Syncing your Lichess games",
      canSync: false,
    });
  });

  test("backoff explains the wait and when it retries", () => {
    expect(describeSync({ ...idle, state: "backoff", retryAt: minutes(3) }, NOW)).toEqual({
      tone: "warning",
      message: "Lichess asked us to slow down. Retrying in 3 min.",
      canSync: false,
    });
  });

  test("backoff past its retry time says it retries shortly", () => {
    expect(describeSync({ ...idle, state: "backoff", retryAt: minutes(-1) }, NOW).message).toBe(
      "Lichess asked us to slow down. Retrying shortly.",
    );
  });

  test("backoff without a retry time still explains the wait", () => {
    expect(describeSync({ ...idle, state: "backoff", retryAt: null }, NOW).message).toBe(
      "Lichess asked us to slow down. Retrying shortly.",
    );
  });

  test("failed asks for a manual retry (only Sync now retries a failed import)", () => {
    expect(describeSync({ ...idle, state: "failed" }, NOW)).toEqual({
      tone: "error",
      message: "The last sync failed. Use Sync now to try again.",
      canSync: true,
    });
  });
});
