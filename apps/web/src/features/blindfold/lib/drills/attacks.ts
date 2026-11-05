/**
 * Attack geometry for piece lists: which squares a piece hits, who attacks a square, and whether a
 * king is in check. Sliding pieces stop at the first piece of either colour (and attack it).
 */
import { formatSquare, parseSquare, type Square } from "../squares";
import type { PieceColour, PlacedPiece } from "./types";

type Step = readonly [number, number];

const ROOK_STEPS: readonly Step[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_STEPS: readonly Step[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KING_STEPS: readonly Step[] = [...ROOK_STEPS, ...BISHOP_STEPS];
const KNIGHT_STEPS: readonly Step[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

function coordinates(square: Square) {
  const parsed = parseSquare(square);
  if (!parsed) throw new Error(`Invalid square: ${square}`);
  return parsed;
}

const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

function leaps(square: Square, steps: readonly Step[]): Square[] {
  const { file, rank } = coordinates(square);
  return steps
    .filter(([df, dr]) => onBoard(file + df, rank + dr))
    .map(([df, dr]) => formatSquare(file + df, rank + dr));
}

function slides(square: Square, steps: readonly Step[], occupied: ReadonlySet<Square>): Square[] {
  const { file, rank } = coordinates(square);
  const result: Square[] = [];
  for (const [df, dr] of steps) {
    for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
      const next = formatSquare(f, r);
      result.push(next);
      if (occupied.has(next)) break;
    }
  }
  return result;
}

/** Every square `piece` attacks with the other `pieces` on the board (blockers included). */
export function attackedSquares(pieces: readonly PlacedPiece[], piece: PlacedPiece): Square[] {
  const occupied = new Set(pieces.map((placed) => placed.square));
  switch (piece.piece) {
    case "K":
      return leaps(piece.square, KING_STEPS);
    case "N":
      return leaps(piece.square, KNIGHT_STEPS);
    case "P": {
      const forward = piece.colour === "white" ? 1 : -1;
      return leaps(piece.square, [
        [-1, forward],
        [1, forward],
      ]);
    }
    case "R":
      return slides(piece.square, ROOK_STEPS, occupied);
    case "B":
      return slides(piece.square, BISHOP_STEPS, occupied);
    case "Q":
      return slides(piece.square, KING_STEPS, occupied);
  }
}

/** The pieces of `byColour` that attack `square`. */
export function attackers(
  pieces: readonly PlacedPiece[],
  square: Square,
  byColour: PieceColour,
): PlacedPiece[] {
  return pieces.filter(
    (piece) => piece.colour === byColour && attackedSquares(pieces, piece).includes(square),
  );
}

/** The enemy pieces giving check to the `colour` king (empty when it is safe or missing). */
export function checkers(pieces: readonly PlacedPiece[], colour: PieceColour): PlacedPiece[] {
  const king = pieces.find((piece) => piece.piece === "K" && piece.colour === colour);
  if (!king) return [];
  return attackers(pieces, king.square, colour === "white" ? "black" : "white");
}

export function isInCheck(pieces: readonly PlacedPiece[], colour: PieceColour): boolean {
  return checkers(pieces, colour).length > 0;
}

/**
 * The squares strictly between two squares on one rank, file or diagonal, walking from `from`
 * towards `to`; empty when they are not aligned or are neighbours.
 */
export function squaresBetween(from: Square, to: Square): Square[] {
  const a = coordinates(from);
  const b = coordinates(to);
  const df = b.file - a.file;
  const dr = b.rank - a.rank;
  const aligned = df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr);
  if (!aligned || (df === 0 && dr === 0)) return [];
  const steps = Math.max(Math.abs(df), Math.abs(dr));
  const sf = Math.sign(df);
  const sr = Math.sign(dr);
  return Array.from({ length: steps - 1 }, (_, index) =>
    formatSquare(a.file + sf * (index + 1), a.rank + sr * (index + 1)),
  );
}
