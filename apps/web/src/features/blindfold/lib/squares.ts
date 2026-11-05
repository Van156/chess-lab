/** Board geometry for the blindfold drills: algebraic squares, colours, diagonals, knight paths. */

const FILE_LETTERS = "abcdefgh";
const SIZE = 8;

export type Square = string;
export type SquareColour = "dark" | "light";
/** Zero-based coordinates: `file` 0 is the a-file, `rank` 0 is the first rank. */
export type Coordinates = { file: number; rank: number };

/** Formats zero-based coordinates as an algebraic square, e.g. `(4, 3)` -> `"e4"`. */
export function formatSquare(file: number, rank: number): Square {
  return `${FILE_LETTERS[file]}${rank + 1}`;
}

/** Every square, a1 first, rank by rank. */
export const ALL_SQUARES: readonly Square[] = Array.from({ length: SIZE * SIZE }, (_, index) =>
  formatSquare(index % SIZE, Math.floor(index / SIZE)),
);

/** Parses an algebraic square (trimmed, case-insensitive); `null` when the input is not a square. */
export function parseSquare(input: string): Coordinates | null {
  const match = /^([a-h])([1-8])$/.exec(input.trim().toLowerCase());
  if (!match) return null;
  return { file: FILE_LETTERS.indexOf(match[1] ?? ""), rank: Number(match[2]) - 1 };
}

function coordinatesOf(square: Square): Coordinates {
  const parsed = parseSquare(square);
  if (!parsed) throw new Error(`Invalid square: ${square}`);
  return parsed;
}

/** a1 is dark and h1 is light: a square is dark when file and rank indices have an even sum. */
export function squareColour(square: Square): SquareColour {
  const { file, rank } = coordinatesOf(square);
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

/**
 * Both diagonals through a square, ordered from the a-file towards the h-file.
 * `rising` runs a1-h8 style (up and to the right), `falling` runs a8-h1 style.
 */
export function diagonalsThrough(square: Square): { rising: Square[]; falling: Square[] } {
  const { file, rank } = coordinatesOf(square);
  const rising: Square[] = [];
  const falling: Square[] = [];
  for (let f = 0; f < SIZE; f++) {
    const up = rank - file + f;
    if (up >= 0 && up < SIZE) rising.push(formatSquare(f, up));
    const down = rank + file - f;
    if (down >= 0 && down < SIZE) falling.push(formatSquare(f, down));
  }
  return { rising, falling };
}

const KNIGHT_STEPS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

/**
 * One shortest knight route between two squares (breadth-first search), start and target
 * included: `["e4"]` for the same square, at most seven squares. Steps are tried in a fixed order,
 * so the same pair always gives the same route.
 */
export function knightPath(from: Square, to: Square): Square[] {
  const start = coordinatesOf(from);
  const target = coordinatesOf(to);
  const key = ({ file, rank }: Coordinates) => file * SIZE + rank;
  const parents = new Map<number, Coordinates | null>([[key(start), null]]);
  const queue: Coordinates[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) break;
    if (current.file === target.file && current.rank === target.rank) {
      const path: Square[] = [];
      for (let step: Coordinates | null = current; step; step = parents.get(key(step)) ?? null) {
        path.unshift(formatSquare(step.file, step.rank));
      }
      return path;
    }
    for (const [df, dr] of KNIGHT_STEPS) {
      const next = { file: current.file + df, rank: current.rank + dr };
      if (next.file < 0 || next.file >= SIZE || next.rank < 0 || next.rank >= SIZE) continue;
      if (parents.has(key(next))) continue;
      parents.set(key(next), current);
      queue.push(next);
    }
  }
  throw new Error(`Unreachable: ${from} -> ${to}`);
}

/** Fewest knight moves between two squares; 0 for the same square, at most 6. */
export function knightDistance(from: Square, to: Square): number {
  return knightPath(from, to).length - 1;
}

/** A square's file letter, that file's number (a = 1) and its rank, e.g. e4 -> e, 5, 4. */
export function fileAndRank(square: Square): { file: string; fileNumber: number; rank: number } {
  const { file, rank } = coordinatesOf(square);
  return { file: FILE_LETTERS[file] ?? "", fileNumber: file + 1, rank: rank + 1 };
}
