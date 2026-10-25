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
