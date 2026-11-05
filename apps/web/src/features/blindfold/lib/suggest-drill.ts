import type { DrillInfo } from "./drill-catalog";
import { dayKey, daysBetween } from "./practice-summary";
import type { DrillKind } from "./questions";

/** When a drill was last played, as `blindfold.stats` returns it (null or absent: never). */
export type DrillRecency = { drill: DrillKind; lastPlayedAt?: Date | string | null };

function playedAt(recency: readonly DrillRecency[], kind: DrillKind): number | null {
  const value = recency.find((entry) => entry.drill === kind)?.lastPlayedAt;
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * The drill to suggest next: the one played least recently. A drill never played counts as the
 * least recent, so a new player starts with the first drill and then meets each drill in catalogue
 * order before any repeats. Ties keep catalogue order. `null` only when `drills` is empty.
 */
export function suggestDrill(
  drills: readonly DrillInfo[],
  recency: readonly DrillRecency[] = [],
): DrillInfo | null {
  let best: DrillInfo | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const drill of drills) {
    const time = playedAt(recency, drill.kind) ?? Number.NEGATIVE_INFINITY;
    if (best === null || time < bestTime) {
      best = drill;
      bestTime = time;
    }
  }
  return best;
}

/** When a drill was last played, in words relative to `today` (`YYYY-MM-DD`). */
export function describeLastPlayed(
  lastPlayedAt: Date | string | null | undefined,
  today: string,
): string {
  if (lastPlayedAt === null || lastPlayedAt === undefined) return "New to you";
  const date = new Date(lastPlayedAt);
  if (Number.isNaN(date.getTime())) return "New to you";
  const days = daysBetween(dayKey(date), today);
  if (days <= 0) return "Last played today";
  if (days === 1) return "Last played yesterday";
  return `Last played ${days} days ago`;
}
