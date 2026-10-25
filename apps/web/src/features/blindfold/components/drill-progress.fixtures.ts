import type { DrillStat } from "../lib/drill-stats";

const session = (id: string, correct: number) => ({ id, correct, total: 20, durationMs: 90_000 });

/** Newest first, as the API returns them. */
export const PLAYED_STATS: DrillStat[] = [
  {
    drill: "square_colour",
    sessions: 12,
    bestAccuracy: 1,
    recent: [session("s5", 19), session("s4", 17), session("s3", 15), session("s2", 12)],
  },
  {
    drill: "coordinates",
    sessions: 2,
    bestAccuracy: 0.8,
    recent: [session("c2", 16), session("c1", 11)],
  },
  { drill: "diagonals", sessions: 0, bestAccuracy: null, recent: [] },
  { drill: "knight_distance", sessions: 1, bestAccuracy: 0.55, recent: [session("k1", 11)] },
];

export const EMPTY_STATS: DrillStat[] = (
  ["square_colour", "coordinates", "diagonals", "knight_distance"] as const
).map((drill) => ({ drill, sessions: 0, bestAccuracy: null, recent: [] }));
