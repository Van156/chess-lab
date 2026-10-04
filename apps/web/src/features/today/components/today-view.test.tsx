import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SyncStatus, TodaySummary } from "../lib/today-types";
import TodayView from "./today-view";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const synced: SyncStatus = {
  state: "idle",
  lastSyncedAt: new Date(NOW - 5 * 60_000),
  retryAt: null,
  gamesImported: 12,
};

function render(overrides: Partial<TodaySummary> = {}, syncPending = false) {
  const summary: TodaySummary = {
    due: { mistakes: 7 },
    dueTotal: 7,
    newBudgetLeft: 3,
    streak: { days: 4, reviewedToday: false },
    sync: synced,
    ...overrides,
  };
  return renderToStaticMarkup(
    <TodayView
      summary={summary}
      now={NOW}
      reviewAction={<a href="/review">Start review</a>}
      onSyncNow={() => {}}
      syncPending={syncPending}
    />,
  );
}

const syncNowDisabled = /<button[^>]*\sdisabled=""[^>]*>Sync now/;

describe("TodayView due state", () => {
  test("shows the due count, the per-pillar split and the start action", () => {
    const html = render();
    expect(html).toContain("Today&#x27;s review");
    expect(html).toContain(">7</span> Mistakes");
    expect(html).toContain("Start review");
  });

  test("shows the new-card allowance and the streak nudge", () => {
    const html = render();
    expect(html).toContain("New cards left today");
    expect(html).toContain("4-day streak, review today to keep it");
  });

  test("keeps the start action while only new cards are allowed", () => {
    const html = render({ dueTotal: 0, due: {}, newBudgetLeft: 2 });
    expect(html).toContain("Start review");
  });
});

describe("TodayView caught-up state", () => {
  const html = render({ dueTotal: 0, due: {}, newBudgetLeft: 0 });

  test("says the queue is complete", () => {
    expect(html).toContain("You&#x27;re all caught up");
    expect(html).toContain("Your review queue is complete for today.");
  });

  test("offers no start action", () => {
    expect(html).not.toContain("Start review");
  });
});

describe("TodayView onboarding state", () => {
  const html = render({
    dueTotal: 0,
    due: {},
    newBudgetLeft: 0,
    sync: { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 },
  });

  test("directs the user to import games", () => {
    expect(html).toContain("Import your Lichess games");
    expect(html).toContain("Import my games");
  });

  test("does not duplicate the import action in the status line", () => {
    expect(html).not.toContain("Sync now");
  });
});

describe("TodayView sync status", () => {
  test("shows when the last sync ran and enables Sync now", () => {
    const html = render();
    expect(html).toContain("Last synced 5 min ago");
    expect(html).toContain("Sync now");
    expect(html).not.toMatch(syncNowDisabled);
  });

  test("explains a rate-limit backoff and disables Sync now", () => {
    const html = render({
      sync: { ...synced, state: "backoff", retryAt: new Date(NOW + 3 * 60_000) },
    });
    expect(html).toContain("Lichess asked us to slow down. Retrying in 3 min.");
    expect(html).toMatch(syncNowDisabled);
  });

  test("tells the user a failed sync needs a manual retry", () => {
    const html = render({ sync: { ...synced, state: "failed" } });
    expect(html).toContain("The last sync failed. Use Sync now to try again.");
    expect(html).not.toMatch(syncNowDisabled);
  });

  test("disables Sync now while a manual sync request is in flight", () => {
    expect(render({}, true)).toMatch(syncNowDisabled);
  });

  test("announces the status politely", () => {
    expect(render()).toContain('role="status"');
  });
});
