import {
  EXPLORER_BAND_OFFSET_MAX,
  EXPLORER_BAND_OFFSET_MIN,
  EXPLORER_BAND_SPEEDS,
  EXPLORER_RATING_BUCKETS,
  FALLBACK_EXPLORER_BAND,
} from "./config";

/** Structural subset of a Lichess perf snapshot; kept local so this package does not depend on the Lichess client. */
export type PerfSnapshot = Partial<
  Record<string, { rating?: number; games?: number; prov?: boolean }>
>;

/**
 * The single rule choosing the explorer rating band.
 *
 * The own band is the largest bucket not above the rating of the speed (blitz, rapid or classical)
 * with the most games; provisional or unrated perfs are skipped and ties go to the earlier speed.
 * With no usable perf it is the fallback band. The offset then moves whole buckets (truncated,
 * limited to the allowed range, and stopping at the ends of the list), so "one band above" is `1`.
 */
export function ratingBandFor(perfs: PerfSnapshot | null | undefined, offset = 0): number {
  const lastIndex = EXPLORER_RATING_BUCKETS.length - 1;
  const ownIndex = bucketIndex(mainRating(perfs));
  const steps = Number.isNaN(offset)
    ? 0
    : Math.min(EXPLORER_BAND_OFFSET_MAX, Math.max(EXPLORER_BAND_OFFSET_MIN, Math.trunc(offset)));
  return EXPLORER_RATING_BUCKETS[Math.min(lastIndex, Math.max(0, ownIndex + steps))]!;
}

function mainRating(perfs: PerfSnapshot | null | undefined): number | null {
  let best: { rating: number; games: number } | null = null;
  for (const speed of EXPLORER_BAND_SPEEDS) {
    const perf = perfs?.[speed];
    if (!perf || perf.prov === true) continue;
    const { rating, games } = perf;
    if (rating === undefined || !Number.isFinite(rating)) continue;
    if (games === undefined || !(games > 0)) continue;
    if (!best || games > best.games) best = { rating, games };
  }
  return best ? best.rating : null;
}

function bucketIndex(rating: number | null): number {
  if (rating === null) return EXPLORER_RATING_BUCKETS.indexOf(FALLBACK_EXPLORER_BAND);
  let index = 0;
  EXPLORER_RATING_BUCKETS.forEach((bucket, i) => {
    if (bucket <= rating) index = i;
  });
  return index;
}
