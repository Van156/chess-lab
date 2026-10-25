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

/** Fewest knight moves between two squares (breadth-first search); 0 for the same square, at most 6. */
export function knightDistance(from: Square, to: Square): number {
  const start = coordinatesOf(from);
  const target = coordinatesOf(to);
  const key = ({ file, rank }: Coordinates) => file * SIZE + rank;
  const distances = new Map<number, number>([[key(start), 0]]);
  const queue: Coordinates[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) break;
    const steps = distances.get(key(current)) ?? 0;
    if (current.file === target.file && current.rank === target.rank) return steps;
    for (const [df, dr] of KNIGHT_STEPS) {
      const next = { file: current.file + df, rank: current.rank + dr };
      if (next.file < 0 || next.file >= SIZE || next.rank < 0 || next.rank >= SIZE) continue;
      if (distances.has(key(next))) continue;
      distances.set(key(next), steps + 1);
      queue.push(next);
    }
  }
  throw new Error(`Unreachable: ${from} -> ${to}`);
}
