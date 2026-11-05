/**
 * Pure planning for the analysis pipeline (ADR-12): which positions to evaluate, how engine
 * results map to stored evaluations, and how evaluations are batched for `submitEvals`.
 * `evals[i]` is the position after `i` plies, so a game of N plies has positions 0..N.
 */
import { applyMove, parseGame, screenCandidates, type PlyEval } from "@b2c-template/chess";

import { CONFIRM_DEPTH } from "../config";
import type { EngineResult } from "./engine-queue";

/** FEN of every position 0..N of a game (N + 1 entries). Throws on an unreadable PGN. */
export function positionFens(pgn: string): string[] {
  const { plies } = parseGame(pgn);
  const fens = plies.map((ply) => ply.fenBefore);
  const last = plies.at(-1);
  if (!last) return fens;
  // The position after the last ply; null only if the stored move cannot be replayed.
  const final = applyMove(last.fenBefore, last.uci);
  if (final) fens.push(final);
  return fens;
}

/**
 * The stored form of an engine result, relative to the side to move (UCI). A position with no
 * score (checkmate or stalemate, where the engine reports no move) has no evaluation: `null`.
 */
export function toPlyEval(result: EngineResult): PlyEval {
  if (!result.score || result.depth < 1) return null;
  const score =
    result.score.kind === "mate" ? { mate: result.score.value } : { cp: result.score.value };
  return {
    ...score,
    depth: result.depth,
    ...(result.bestMove ? { bestUci: result.bestMove } : {}),
  };
}

/** Positions still to screen: from the server's resume point through the last position. */
export function screenIndices(nextPly: number, positionCount: number): number[] {
  const from = Math.max(0, nextPly);
  return Array.from({ length: Math.max(0, positionCount - from) }, (_, i) => from + i);
}

/**
 * Positions to re-evaluate at confirm depth: the position before and after each of the user's
 * moves whose screened loss reaches the inaccuracy threshold, minus positions that already hold a
 * confirm-depth evaluation (a resumed game). Ascending and unique.
 */
export function confirmIndices(
  pgn: string,
  evals: readonly PlyEval[],
  userColor: "white" | "black",
): number[] {
  const { plies } = parseGame(pgn);
  const candidates = screenCandidates(plies, [...evals], userColor === "white" ? "w" : "b");
  const wanted = new Set<number>();
  for (const ply of candidates) {
    wanted.add(ply - 1);
    wanted.add(ply);
  }
  return [...wanted]
    .filter((index) => (evals[index]?.depth ?? 0) < CONFIRM_DEPTH)
    .toSorted((a, b) => a - b);
}

export type SubmitPhase = "screen" | "confirm";

/** Evaluations waiting to be sent: `evals[i]` belongs to ply `fromPly + i`. */
export interface Batch {
  phase: SubmitPhase;
  fromPly: number;
  evals: PlyEval[];
}

export const emptyBatch = (phase: SubmitPhase): Batch => ({ phase, fromPly: 0, evals: [] });

/** True when `index` continues the batch (or the batch is empty) without a gap. */
export const canAppend = (batch: Batch, index: number, phase: SubmitPhase): boolean =>
  batch.phase === phase &&
  (batch.evals.length === 0 || index === batch.fromPly + batch.evals.length);

export function append(batch: Batch, index: number, value: PlyEval): Batch {
  return batch.evals.length === 0
    ? { ...batch, fromPly: index, evals: [value] }
    : { ...batch, evals: [...batch.evals, value] };
}

export const isFull = (batch: Batch, size: number): boolean => batch.evals.length >= size;
