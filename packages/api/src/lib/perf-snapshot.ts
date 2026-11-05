import type { PerfSnapshot } from "@b2c-template/chess";
import { z } from "zod";

const perfEntry = z.object({
  rating: z.number().finite().optional(),
  games: z.number().finite().optional(),
  prov: z.boolean().optional(),
});

const perfSnapshot = z.record(z.string(), perfEntry);

/**
 * Reads the untyped `lichess_profile.rating_snapshot` jsonb. Anything that is not an object of
 * well-formed perf entries counts as unknown (`null`), so the fallback band applies.
 */
export function parsePerfSnapshot(raw: unknown): PerfSnapshot | null {
  const parsed = perfSnapshot.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
