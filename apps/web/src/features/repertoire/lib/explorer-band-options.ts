import {
  EXPLORER_BAND_OFFSET_MAX,
  EXPLORER_BAND_OFFSET_MIN,
  EXPLORER_RATING_BUCKETS,
} from "@b2c-template/chess";

import { bandLabel } from "./explorer-view";

export type BandOption = { offset: number; band: number; label: string };

const offsetName = (offset: number): string => {
  if (offset === 0) return "your band";
  return `${Math.abs(offset)} ${offset < 0 ? "below" : "above"}`;
};

/**
 * The bands the user can choose from: the own band and up to two buckets each side, clamped to the
 * ends of the bucket list. An offset that lands on a band a nearer offset already gives is left
 * out, so no band is listed twice and each label states the real distance. Sorted by offset.
 */
export function bandOptions(ownBand: number): BandOption[] {
  const buckets: readonly number[] = EXPLORER_RATING_BUCKETS;
  const own = buckets.indexOf(ownBand);
  if (own === -1) return [{ offset: 0, band: ownBand, label: `${bandLabel(ownBand)} (your band)` }];

  const offsets: number[] = [];
  for (let offset = EXPLORER_BAND_OFFSET_MIN; offset <= EXPLORER_BAND_OFFSET_MAX; offset += 1) {
    offsets.push(offset);
  }
  const seen = new Set<number>();
  const options: BandOption[] = [];
  for (const offset of offsets.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)) {
    const band = buckets[Math.min(Math.max(own + offset, 0), buckets.length - 1)];
    if (band === undefined || seen.has(band)) continue;
    seen.add(band);
    options.push({
      offset,
      band,
      label: `${bandLabel(band)} (${offsetName(offset)})`,
    });
  }
  return options.sort((a, b) => a.offset - b.offset);
}
