import {
  DEFAULT_THRESHOLDS,
  ENDGAME_MATERIAL,
  EVAL_CLAMP_CP,
  MATE_CP,
  OPENING_PLY_LIMIT,
  TIME_PRESSURE_RATIO,
} from "./config";
import type { Severity, Thresholds } from "./config";
import { parseGame } from "./pgn";
import type { ParsedPly } from "./pgn";
import { parseMove, positionKey } from "./position";
import type { PositionKey } from "./position";

/**
 * Engine evaluation of one position, relative to the side to move (UCI convention).
 * `evals[i]` is the position after `i` plies, so `evals[ply - 1]` is the position before a ply
 * and `evals[ply]` the position after it. `bestUci` is the engine's best move in that position.
 */
export type PlyEval = { cp?: number; mate?: number; depth: number; bestUci?: string } | null;

export type Phase = "opening" | "middlegame" | "endgame";

export type ClassifiedMistake = {
  ply: number;
  positionKey: PositionKey;
  fenBefore: string;
  playedSan: string;
  playedUci: string;
  bestSan: string;
  bestUci: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  evalLossCp: number;
  severity: Severity;
  phase: Phase;
  clockLeftMs: number | null;
  clockInitialMs: number | null;
};

// `+ 0` normalizes negative zero so stored values never show `-0`.
const clamp = (cp: number) => Math.max(-EVAL_CLAMP_CP, Math.min(EVAL_CLAMP_CP, cp)) + 0;

/** Centipawns from the evaluated side's perspective: mate mapped to plus or minus `MATE_CP`, then clamped. */
export function sideToMoveCp(e: NonNullable<PlyEval>): number {
  if (e.mate !== undefined) return clamp(e.mate > 0 ? MATE_CP : -MATE_CP);
  return clamp(e.cp ?? 0);
}

const hasScore = (e: PlyEval | undefined): e is NonNullable<PlyEval> =>
  !!e && (e.cp !== undefined || e.mate !== undefined);

/** Before and after scores from the mover's perspective, or null when either eval is missing. */
function moverScores(ply: ParsedPly, evals: PlyEval[]) {
  const before = evals[ply.ply - 1];
  const after = evals[ply.ply];
  if (!hasScore(before) || !hasScore(after)) return null;
  const evalBeforeCp = sideToMoveCp(before);
  // The position after the move is evaluated for the opponent: flip to the mover's side.
  const evalAfterCp = 0 - sideToMoveCp(after);
  return { before, evalBeforeCp, evalAfterCp, evalLossCp: evalBeforeCp - evalAfterCp };
}

function severityFor(loss: number, t: Thresholds): Severity | null {
  if (loss >= t.blunder) return "blunder";
  if (loss >= t.mistake) return "mistake";
  if (loss >= t.inaccuracy) return "inaccuracy";
  return null;
}

/** Ply numbers of the user's moves whose (shallow) eval loss reaches the inaccuracy threshold. */
export function screenCandidates(
  plies: ParsedPly[],
  evals: PlyEval[],
  userColor: "w" | "b",
  t: Thresholds = DEFAULT_THRESHOLDS,
): number[] {
  return plies
    .filter((p) => p.color === userColor)
    .filter((p) => {
      const s = moverScores(p, evals);
      return s !== null && s.evalLossCp >= t.inaccuracy;
    })
    .map((p) => p.ply);
}

const PIECE_POINTS: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };

function nonPawnMaterial(placement: string) {
  const totals = { w: 0, b: 0 };
  for (const ch of placement) {
    const points = PIECE_POINTS[ch.toLowerCase()];
    if (points === undefined) continue;
    totals[ch === ch.toUpperCase() ? "w" : "b"] += points;
  }
  return totals;
}

/** Phase of the position before a move: endgame by material, else opening below the ply limit. */
export function gamePhase(fenBefore: string, ply: number): Phase {
  const { w, b } = nonPawnMaterial(fenBefore.split(" ")[0] ?? "");
  if (w <= ENDGAME_MATERIAL && b <= ENDGAME_MATERIAL) return "endgame";
  return ply < OPENING_PLY_LIMIT ? "opening" : "middlegame";
}

/** True when the clock left is strictly below `TIME_PRESSURE_RATIO` of the base clock time. */
export function isTimePressure(clockLeftMs: number | null, clockInitialMs: number | null): boolean {
  if (clockLeftMs === null || clockInitialMs === null || clockInitialMs <= 0) return false;
  return clockLeftMs < TIME_PRESSURE_RATIO * clockInitialMs;
}

/** Classify the user's moves from confirmed evals. Pure and deterministic (safe to upsert by `(game, ply)`). */
export function classifyGame(
  input: { pgn: string; evals: PlyEval[]; userColor: "w" | "b" },
  t: Thresholds = DEFAULT_THRESHOLDS,
): ClassifiedMistake[] {
  const { plies, initialClockMs } = parseGame(input.pgn);
  const mistakes: ClassifiedMistake[] = [];

  for (const ply of plies) {
    if (ply.color !== input.userColor) continue;
    const scores = moverScores(ply, input.evals);
    if (!scores) continue;
    const severity = severityFor(scores.evalLossCp, t);
    if (!severity || !scores.before.bestUci) continue;
    const best = parseMove(ply.fenBefore, scores.before.bestUci);
    if (!best) continue;

    mistakes.push({
      ply: ply.ply,
      positionKey: positionKey(ply.fenBefore),
      fenBefore: ply.fenBefore,
      playedSan: ply.san,
      playedUci: ply.uci,
      bestSan: best.san,
      bestUci: best.uci,
      evalBeforeCp: scores.evalBeforeCp,
      evalAfterCp: scores.evalAfterCp,
      evalLossCp: scores.evalLossCp,
      severity,
      phase: gamePhase(ply.fenBefore, ply.ply),
      clockLeftMs: ply.clockMs,
      clockInitialMs: initialClockMs,
    });
  }
  return mistakes;
}
