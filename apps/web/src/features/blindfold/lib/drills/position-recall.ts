/** "Move memory": a short opening line is shown move by move; the player says what stands on a square. */
import { Chess, type Square as ChessSquare } from "chess.js";

import type { Rng } from "../rng";
import { ALL_SQUARES, type Square } from "../squares";
import { OPENING_LINES } from "./opening-lines";
import type { DrillModule, PositionRecallQuestion } from "./types";

/** Inclusive ply ranges by level; levels above the last reuse it. */
const PLY_RANGES: readonly (readonly [number, number])[] = [
  [4, 6],
  [8, 10],
  [12, 16],
];
/** Share of questions about a square a piece left (answer: empty). */
const EMPTY_SHARE = 0.25;
/** Share of questions about a square a piece moved to and still stands on. */
const MOVED_PIECE_SHARE = 0.6;

const EMPTY = "empty";
const COLOUR_NAMES: Record<string, string> = { w: "White", b: "Black" };
const PIECE_NAMES: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

function plyCount(level: number, rng: Rng, available: number): number {
  const [low, high] = PLY_RANGES[Math.min(level, PLY_RANGES.length) - 1] ?? [4, 6];
  return Math.min(available, low + rng.int(high - low + 1));
}

function codeAt(chess: Chess, square: Square): string {
  const piece = chess.get(square as ChessSquare);
  return piece ? `${piece.color}${piece.type.toUpperCase()}` : EMPTY;
}

/** Squares whose contents changed at some point during the moves (castling rooks included). */
function touchedSquares(moves: readonly string[]): { chess: Chess; touched: Set<Square> } {
  const chess = new Chess();
  const touched = new Set<Square>();
  for (const move of moves) {
    const before = ALL_SQUARES.map((square) => codeAt(chess, square));
    chess.move(move);
    ALL_SQUARES.forEach((square, index) => {
      if (codeAt(chess, square) !== before[index]) touched.add(square);
    });
  }
  return { chess, touched };
}

function chooseSquare(chess: Chess, touched: Set<Square>, rng: Rng): Square {
  const vacated = ALL_SQUARES.filter((s) => touched.has(s) && codeAt(chess, s) === EMPTY);
  const moved = ALL_SQUARES.filter((s) => touched.has(s) && codeAt(chess, s) !== EMPTY);
  const unmoved = ALL_SQUARES.filter((s) => !touched.has(s) && codeAt(chess, s) !== EMPTY);
  const roll = rng.next();
  const preferred =
    roll < EMPTY_SHARE ? vacated : roll < EMPTY_SHARE + MOVED_PIECE_SHARE ? moved : unmoved;
  const fallback = [vacated, moved, unmoved].find((group) => group.length > 0) ?? ALL_SQUARES;
  return rng.pick(preferred.length > 0 ? preferred : fallback);
}

export const positionRecall: DrillModule<PositionRecallQuestion> = {
  generate: ({ level, rng }) => {
    const line = rng.pick(OPENING_LINES);
    const moves = line.moves.slice(0, plyCount(level, rng, line.moves.length));
    const { chess, touched } = touchedSquares(moves);
    const square = chooseSquare(chess, touched, rng);
    return { kind: "position_recall", moves, square, expected: codeAt(chess, square) };
  },
  isCorrect: (question, answer) =>
    typeof answer === "string" && answer.trim().toLowerCase() === question.expected.toLowerCase(),
  describe: (question) => `What stands on ${question.square} now?`,
  expectedText: (question) => {
    if (question.expected === EMPTY) return "Nothing — it is empty";
    const colour = COLOUR_NAMES[question.expected[0] ?? ""] ?? "";
    const piece = PIECE_NAMES[question.expected[1] ?? ""] ?? "";
    return `${colour} ${piece}`;
  },
};
