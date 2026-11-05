/** `m:ss` for a duration in milliseconds; negative values count as zero. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** A fraction in [0, 1] as a whole percent, e.g. `0.85` becomes `85%`. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Seconds with one decimal, e.g. `4150` becomes `4.2s`. */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * How long ago `date` was, in calendar days relative to `now` (local time): "Today",
 * "Yesterday", "3 days ago", "2 weeks ago", "4 months ago", "1 year ago". A date after `now`
 * counts as today; an invalid date gives null.
 */
export function formatRelativeDay(date: string | number | Date, now: number | Date): string | null {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(then)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.floor(days / 7), "week");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}
