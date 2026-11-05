/** Small chess computations for the reveal boards: replaying SAN, locating a move, diagonals. */
import { Chess } from "chess.js";

import { parseSquare, formatSquare, type Square } from "../../lib/squares";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type Replay = { fen: string; lastMove: { from: Square; to: Square } | null };

/** Plays SAN moves from the start position, stopping quietly at the first illegal one. */
export function replayMoves(moves: readonly string[]): Replay {
  const game = new Chess();
  let lastMove: Replay["lastMove"] = null;
  for (const san of moves) {
    try {
      const move = game.move(san);
      lastMove = { from: move.from, to: move.to };
    } catch {
      break;
    }
  }
  return { fen: game.fen(), lastMove };
}

/** The from/to squares of a SAN move in a position, or `null` when it is not legal there. */
export function locateMove(fen: string, san: string): { from: Square; to: Square } | null {
  try {
    const move = new Chess(fen).move(san);
    return { from: move.from, to: move.to };
  } catch {
    return null;
  }
}

/** Every square from `a` to `b` inclusive when they share a diagonal, otherwise `null`. */
export function diagonalPath(a: Square, b: Square): Square[] | null {
  const from = parseSquare(a);
  const to = parseSquare(b);
  if (!from || !to) return null;
  const df = to.file - from.file;
  const dr = to.rank - from.rank;
  if (df === 0 || Math.abs(df) !== Math.abs(dr)) return null;
  const stepFile = Math.sign(df);
  const stepRank = Math.sign(dr);
  return Array.from({ length: Math.abs(df) + 1 }, (_, index) =>
    formatSquare(from.file + stepFile * index, from.rank + stepRank * index),
  );
}

/** The two ends of the full diagonal through a path, e.g. `"a1-h8"`, read from the a-file side. */
export function diagonalName(path: readonly Square[]): string {
  const first = parseSquare(path[0] ?? "");
  const last = parseSquare(path[path.length - 1] ?? "");
  if (!first || !last) return "";
  const [left, right] = first.file < last.file ? [first, last] : [last, first];
  const rising = right.rank > left.rank;
  const back = Math.min(left.file, rising ? left.rank : 7 - left.rank);
  const forward = Math.min(7 - right.file, rising ? 7 - right.rank : right.rank);
  const start = formatSquare(left.file - back, left.rank + (rising ? -back : back));
  const end = formatSquare(right.file + forward, right.rank + (rising ? forward : -forward));
  return `${start}-${end}`;
}
