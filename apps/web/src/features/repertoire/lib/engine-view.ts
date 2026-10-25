import { parseMove } from "@b2c-template/chess";

import type { EngineLine } from "@/features/engine";
import type { BoardArrow } from "@/shared/components/board";

import { inRepertoire } from "./explorer-view";

/** An engine score from White's side, whoever is to move. */
export type WhiteScore =
  | { kind: "cp"; cp: number }
  | { kind: "mate"; moves: number; winner: "white" | "black" };

/** One engine line as the suggestion panel shows it. */
export type SuggestionLine = {
  multipv: number;
  depth: number;
  white: WhiteScore;
  /** Short score, such as "+0.34" or "#-2". */
  scoreText: string;
  /** The same score in words, for assistive technology. */
  scoreLabel: string;
  firstMove: { san: string; uci: string };
  /** The engine's whole principal variation in UCI, which the line preview replays. */
  pv: readonly string[];
  /** Move-numbered SAN, such as "12. Nf3 Nc6 13. Bb5". */
  moveText: string;
  /** True when the repertoire already has the first move from this position. */
  inRepertoire: boolean;
};

/** Win-chance curve of Lichess, applied to centipawns clamped to this range. */
const WIN_CHANCE_CLAMP_CP = 1000;
const WIN_CHANCE_SLOPE = 0.00368208;

const UCI_MOVE = /^([a-h][1-8])([a-h][1-8])[qrbn]?$/;

const whiteToMove = (fen: string): boolean => fen.split(" ")[1] !== "b";

/**
 * Converts an engine score, which is relative to the side to move, to White's side. A positive mate
 * is delivered by the side to move, a negative one by the other side, and mate 0 means the side to
 * move is already mated.
 */
export function toWhiteScore(score: EngineLine["score"], fen: string): WhiteScore {
  const white = whiteToMove(fen);
  if (score.kind === "cp") return { kind: "cp", cp: white ? score.value : -score.value };
  const mover = white ? "white" : "black";
  const other = white ? "black" : "white";
  return {
    kind: "mate",
    moves: Math.abs(score.value),
    winner: score.value > 0 ? mover : other,
  };
}

const pawns = (cp: number): string => (Math.abs(cp) / 100).toFixed(2);

/** "+0.34", "-1.20" or "0.00"; a forced mate is "#3" for White and "#-2" for Black. */
export function formatScore(score: WhiteScore): string {
  if (score.kind === "mate") {
    if (score.moves === 0) return "#0";
    return score.winner === "white" ? `#${score.moves}` : `#-${score.moves}`;
  }
  if (score.cp === 0) return pawns(0);
  return `${score.cp > 0 ? "+" : "-"}${pawns(score.cp)}`;
}

/** The score in words, such as "White is better by 0.34 pawns" or "Black mates in 2". */
export function describeScore(score: WhiteScore): string {
  if (score.kind === "mate") {
    if (score.moves === 0) return "Checkmate";
    return `${score.winner === "white" ? "White" : "Black"} mates in ${score.moves}`;
  }
  if (score.cp === 0) return "Even position";
  return `${score.cp > 0 ? "White" : "Black"} is better by ${pawns(score.cp)} pawns`;
}

/** White's share of the win chance, 0 to 100, on the Lichess curve; a mate is 100 or 0. */
export function winPercent(score: WhiteScore): number {
  if (score.kind === "mate") return score.winner === "white" ? 100 : 0;
  const cp = Math.max(-WIN_CHANCE_CLAMP_CP, Math.min(WIN_CHANCE_CLAMP_CP, score.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_CHANCE_SLOPE * cp)) - 1);
}

/**
 * Replays a UCI line from a position. Stops at the first illegal move or after `maxPlies`. The text
 * is numbered from the FEN's fullmove field: "12. Nf3 Nc6 13. Bb5", or "12... Nc6" for Black.
 */
export function pvToSan(
  fen: string,
  pv: readonly string[],
  maxPlies: number,
): { sans: string[]; text: string } {
  const sans: string[] = [];
  const parts: string[] = [];
  let current = fen;
  let white = whiteToMove(fen);
  let number = Number(fen.split(" ")[5]);
  if (!Number.isInteger(number) || number < 1) number = 1;

  for (const uci of pv.slice(0, Math.max(0, maxPlies))) {
    const parsed = parseMove(current, uci);
    if (!parsed) break;
    if (white) parts.push(`${number}. ${parsed.san}`);
    else parts.push(sans.length === 0 ? `${number}... ${parsed.san}` : parsed.san);
    sans.push(parsed.san);
    current = parsed.fenAfter;
    if (!white) number += 1;
    white = !white;
  }
  return { sans, text: parts.join(" ") };
}

/** Arrow for the first move of a line; `null` when the line is empty or the move is malformed. */
export function bestMoveArrow(pv: readonly string[]): BoardArrow | null {
  const match = UCI_MOVE.exec(pv[0] ?? "");
  return match?.[1] && match[2] ? { from: match[1], to: match[2] } : null;
}

/**
 * The suggestion panel's view of the engine lines, in the engine's order. A line whose first move is
 * not legal in the position (a stale line, for instance) is dropped.
 */
export function toSuggestionLines(
  fen: string,
  lines: readonly EngineLine[],
  childMoves: readonly { san: string }[],
  maxPlies: number,
): SuggestionLine[] {
  const result: SuggestionLine[] = [];
  for (const line of lines) {
    const first = parseMove(fen, line.pv[0] ?? "");
    if (!first) continue;
    const white = toWhiteScore(line.score, fen);
    result.push({
      multipv: line.multipv,
      depth: line.depth,
      white,
      scoreText: formatScore(white),
      scoreLabel: describeScore(white),
      firstMove: { san: first.san, uci: first.uci },
      pv: line.pv,
      moveText: pvToSan(fen, line.pv, maxPlies).text,
      inRepertoire: inRepertoire(first.san, childMoves),
    });
  }
  return result;
}
