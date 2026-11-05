const HOUR_MS = 3_600_000;

/**
 * The half-open interval `[start, end)` of the local calendar day containing
 * `now` in `timeZone`. DST days come out 23 or 25 hours long, and a zone whose
 * DST gap swallows local midnight starts at its first valid instant. Throws a
 * RangeError for an unknown IANA zone.
 */
export function localDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  // Calendar day as a sortable integer (yyyymmdd); monotone in real time.
  const dayKey = (ms: number): number => {
    let y = 0;
    let m = 0;
    let d = 0;
    for (const part of format.formatToParts(new Date(ms))) {
      if (part.type === "year") y = Number(part.value);
      else if (part.type === "month") m = Number(part.value);
      else if (part.type === "day") d = Number(part.value);
    }
    return y * 10_000 + m * 100 + d;
  };

  const nowMs = now.getTime();
  const today = dayKey(nowMs);
  // Smallest instant in (lo, hi] for which `pred` holds; pred(hi) must be true.
  const firstTrue = (lo: number, hi: number, pred: (ms: number) => boolean): number => {
    let low = lo;
    let high = hi;
    while (high - low > 1) {
      const mid = low + Math.floor((high - low) / 2);
      if (pred(mid)) high = mid;
      else low = mid;
    }
    return high;
  };

  // A local day never spans more than 26 hours, so these windows bracket it.
  const start = firstTrue(nowMs - 26 * HOUR_MS, nowMs, (ms) => dayKey(ms) >= today);
  const end = firstTrue(nowMs, nowMs + 26 * HOUR_MS, (ms) => dayKey(ms) > today);
  return { start: new Date(start), end: new Date(end) };
}
