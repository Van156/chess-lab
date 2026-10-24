/** Product defaults for classification (ADR-18). Each is a reversible default for a PRD open question. */

export type Thresholds = { inaccuracy: number; mistake: number; blunder: number };

export type Severity = "inaccuracy" | "mistake" | "blunder";

/** Eval loss (centipawns, mover perspective) at which a move becomes an inaccuracy, mistake or blunder. */
export const DEFAULT_THRESHOLDS: Thresholds = { inaccuracy: 50, mistake: 100, blunder: 200 };

/** Severities that get a review card. Inaccuracies are stored but not carded by default. */
export const CARD_SEVERITIES: readonly Severity[] = ["mistake", "blunder"];

/** Centipawn value a forced mate is mapped to (sign follows the winner). */
export const MATE_CP = 1000;

/** Evaluations are clamped to plus or minus this value before computing loss. */
export const EVAL_CLAMP_CP = 1000;

/** A position is `opening` while its ply number is below this and it is not yet an endgame. */
export const OPENING_PLY_LIMIT = 20;

/** Endgame when each side's non-pawn material (Q 9, R 5, B/N 3) is at most this many points. */
export const ENDGAME_MATERIAL = 13;

/** Time pressure when the clock left is strictly below this fraction of the base clock time. */
export const TIME_PRESSURE_RATIO = 0.1;

/** Rating buckets of the Lichess opening explorer `ratings` parameter (a bucket covers its value up to the next one). */
export const EXPLORER_RATING_BUCKETS = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;

/** Band used when the user has no usable rating (no perf with games, or all provisional). */
export const FALLBACK_EXPLORER_BAND = 1600;

/** Speeds that choose the user's band; the explorer is queried with the same speeds. */
export const EXPLORER_BAND_SPEEDS = ["blitz", "rapid", "classical"] as const;

/** The user may move the band by this many buckets down or up (for example +1 is "one band above"). */
export const EXPLORER_BAND_OFFSET_MIN = -2;
export const EXPLORER_BAND_OFFSET_MAX = 2;
