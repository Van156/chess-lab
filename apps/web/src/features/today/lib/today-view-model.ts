import type { SyncStatus, TodaySummary } from "./today-types";

export type TodayMode = "onboarding" | "due" | "caught-up";

/**
 * Which Today state to render. "No games yet" is `gamesImported === 0` with no completed sync;
 * "caught up" is nothing due and no new cards allowed (app-shell / Today home).
 */
export function todayMode(summary: TodaySummary): TodayMode {
  if (summary.sync?.gamesImported === 0 && summary.sync.lastSyncedAt === null) {
    return "onboarding";
  }
  return summary.dueTotal > 0 || summary.newBudgetLeft > 0 ? "due" : "caught-up";
}

const PILLAR_LABELS: Record<string, string> = { mistakes: "Mistakes" };

export type DuePart = { key: string; label: string; count: number };

/** Per-pillar due counts worth showing (positive only), under a display label. */
export function dueParts(due: Record<string, number | undefined>): DuePart[] {
  return Object.entries(due).flatMap(([key, count]) =>
    count !== undefined && count > 0 ? [{ key, label: PILLAR_LABELS[key] ?? key, count }] : [],
  );
}

/** One-line streak text; a streak alive through yesterday nudges a review today. */
export function streakMessage(streak: TodaySummary["streak"]): string {
  if (streak.days === 0) {
    return "No streak yet";
  }
  const base = `${streak.days}-day streak`;
  return streak.reviewedToday ? base : `${base}, review today to keep it`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Coarse human duration: "less than a minute", "5 min", "3 h", "2 d". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) {
    return "less than a minute";
  }
  if (ms < HOUR) {
    return `${Math.floor(ms / MINUTE)} min`;
  }
  if (ms < DAY) {
    return `${Math.floor(ms / HOUR)} h`;
  }
  return `${Math.floor(ms / DAY)} d`;
}

export type SyncTone = "neutral" | "progress" | "warning" | "error";

export type SyncDescription = {
  tone: SyncTone;
  message: string;
  /** Whether "Sync now" is offered; false while a sync runs or Lichess rate limiting backs off. */
  canSync: boolean;
};

/** Message and affordances for the import status. `now` is injected so the text is deterministic. */
export function describeSync(sync: SyncStatus, now: number): SyncDescription {
  switch (sync.state) {
    case "running":
      return { tone: "progress", message: "Syncing your Lichess games", canSync: false };
    case "backoff": {
      const wait = sync.retryAt ? sync.retryAt.getTime() - now : 0;
      const retry = wait > 0 ? `Retrying in ${formatDuration(wait)}.` : "Retrying shortly.";
      return {
        tone: "warning",
        message: `Lichess asked us to slow down. ${retry}`,
        canSync: false,
      };
    }
    case "failed":
      return {
        tone: "error",
        message: "The last sync failed. Use Sync now to try again.",
        canSync: true,
      };
    case "idle":
      return {
        tone: "neutral",
        message: sync.lastSyncedAt
          ? `Last synced ${formatDuration(now - sync.lastSyncedAt.getTime())} ago`
          : "Not synced yet",
        canSync: true,
      };
  }
}
