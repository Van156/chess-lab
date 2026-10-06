import { MATE_CP, parseGame } from "@b2c-template/chess";
import type { BoardArrow } from "@/shared/components/board";

import type { MistakeDetail, MistakeItem } from "./mistakes-types";

type Severity = MistakeItem["severity"];
type Phase = MistakeItem["phase"];

const SEVERITY_LABEL: Record<Severity, string> = {
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

const PHASE_LABEL: Record<Phase, string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
};

export const severityLabel = (severity: Severity): string => SEVERITY_LABEL[severity];
export const phaseLabel = (phase: Phase): string => PHASE_LABEL[phase];

/** Move number and SAN as written in a score: ply 5 is "3. Nf3", ply 6 is "3... Nc6". */
export function moveLabel(ply: number, san: string): string {
  const number = Math.ceil(ply / 2);
  return `${number}${ply % 2 === 1 ? "." : "..."} ${san}`;
}

/** Pawns, one decimal: 120 cp is "1.2". */
export function pawns(cp: number): string {
  return (cp / 100).toFixed(1);
}

/** Evaluation from the mover's side, signed: "+1.2", "-0.4"; a forced mate is spelled out. */
export function formatEval(cp: number): string {
  if (cp >= MATE_CP) return "Mate for you";
  if (cp <= -MATE_CP) return "Mate against you";
  const value = pawns(cp);
  return cp > 0 ? `+${value}` : value;
}

/** Clock left as `m:ss`; `null` when the game has no clock data. */
export function formatClock(ms: number | null): string | null {
  if (ms === null) return null;
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const UCI = /^([a-h][1-8])([a-h][1-8])[qrbn]?$/;

/** Origin and destination squares of a UCI move; `null` for anything that is not one. */
export function uciSquares(uci: string): { from: string; to: string } | null {
  const match = UCI.exec(uci);
  return match?.[1] && match[2] ? { from: match[1], to: match[2] } : null;
}

export const PLAYED_ARROW_COLOR = "#ff6b6b";
export const PLAYED_ARROW_NAME = "red";
export const BEST_ARROW_NAME = "green";

/**
 * Arrows for the position before the mistake: the move played (red) and the engine's best move
 * (the default green), best last so it draws on top. The same two moves are always written out
 * next to the board, so the colours are never the only carrier of meaning.
 */
export function moveArrows(mistake: Pick<MistakeItem, "playedUci" | "bestUci">): BoardArrow[] {
  const played = uciSquares(mistake.playedUci);
  const best = uciSquares(mistake.bestUci);
  return [...(played ? [{ ...played, color: PLAYED_ARROW_COLOR }] : []), ...(best ? [best] : [])];
}

/** Text alternative for the board arrows. */
export function arrowDescription(mistake: Pick<MistakeItem, "playedSan" | "bestSan">): string {
  return (
    `${PLAYED_ARROW_NAME} arrow: you played ${mistake.playedSan}. ` +
    `${BEST_ARROW_NAME} arrow: best move ${mistake.bestSan}.`
  );
}

/** SAN moves of the whole game for the move list; empty when the PGN cannot be read. */
export function movesFromPgn(pgn: string): string[] {
  try {
    return parseGame(pgn).plies.map((ply) => ply.san);
  } catch {
    return [];
  }
}

/** Lichess page of the game, opened from the mistake detail. */
export function lichessGameUrl(game: Pick<MistakeDetail["game"], "lichessGameId">): string {
  return `https://lichess.org/${encodeURIComponent(game.lichessGameId)}`;
}

/** True for an oRPC `NOT_FOUND` error (missing mistake or not the caller's). */
export function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "NOT_FOUND"
  );
}
