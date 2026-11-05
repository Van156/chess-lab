import type { DrillStat } from "../lib/drill-stats";
import { DRILL_KINDS } from "../lib/questions";

const session = (id: string, correct: number) => ({ id, correct, total: 20, durationMs: 90_000 });

/** The fixed "now" stories and tests measure "last played" from. */
export const PROGRESS_NOW = new Date("2026-11-05T10:00:00Z");

const daysAgo = (days: number) =>
  new Date(PROGRESS_NOW.getTime() - days * 86_400_000).toISOString();

/** Every drill, newest session first as the API returns them; two drills are not started. */
export const PLAYED_STATS: DrillStat[] = [
  {
    drill: "square_colour",
    sessions: 12,
    bestAccuracy: 1,
    recent: [session("s5", 19), session("s4", 17), session("s3", 15), session("s2", 12)],
    lastPlayedAt: daysAgo(0),
  },
  {
    drill: "coordinates",
    sessions: 2,
    bestAccuracy: 0.8,
    recent: [session("c2", 16), session("c1", 11)],
    lastPlayedAt: daysAgo(2),
  },
  { drill: "diagonals", sessions: 0, bestAccuracy: null, recent: [], lastPlayedAt: null },
  {
    drill: "same_diagonal",
    sessions: 6,
    bestAccuracy: 0.9,
    recent: [
      session("d6", 18),
      session("d5", 14),
      session("d4", 16),
      session("d3", 13),
      session("d2", 14),
      session("d1", 9),
    ],
    lastPlayedAt: daysAgo(1),
  },
  {
    drill: "knight_distance",
    sessions: 1,
    bestAccuracy: 0.55,
    recent: [session("k1", 11)],
    lastPlayedAt: daysAgo(9),
  },
  {
    drill: "check_detection",
    sessions: 3,
    bestAccuracy: 0.85,
    recent: [session("x3", 15), session("x2", 17), session("x1", 12)],
    lastPlayedAt: daysAgo(4),
  },
  { drill: "position_recall", sessions: 0, bestAccuracy: null, recent: [] },
  {
    drill: "mate_in_one",
    sessions: 2,
    bestAccuracy: 0.45,
    recent: [session("m2", 9), session("m1", 6)],
    lastPlayedAt: daysAgo(40),
  },
];

export const EMPTY_STATS: DrillStat[] = DRILL_KINDS.map((drill) => ({
  drill,
  sessions: 0,
  bestAccuracy: null,
  recent: [],
}));
