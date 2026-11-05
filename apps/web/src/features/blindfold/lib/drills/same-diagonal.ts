/** "Shared diagonal": are two squares on one diagonal? */
import { diagonalsThrough, parseSquare, squareColour, type Square } from "../squares";
import type { DrillModule, SameDiagonalQuestion } from "./types";

/** Levels from this one up make the "no" cases same-colour near misses. */
const TRICKY_LEVEL = 2;

/** The diagonal (ordered from the a-file side) that holds both squares, or `null` if none does. */
export function sharedDiagonal(a: Square, b: Square): Square[] | null {
  if (a === b) return null;
  const { rising, falling } = diagonalsThrough(a);
  if (rising.includes(b)) return rising;
  if (falling.includes(b)) return falling;
  return null;
}

/** How far a pair is from lying on a diagonal: 0 on one, 2 for b1/d1-style near misses. */
function diagonalGap(a: Square, b: Square): number {
  const x = parseSquare(a);
  const y = parseSquare(b);
  if (!x || !y) throw new Error(`Invalid squares: ${a}, ${b}`);
  return Math.abs(Math.abs(x.file - y.file) - Math.abs(x.rank - y.rank));
}

export const sameDiagonal: DrillModule<SameDiagonalQuestion> = {
  generate: ({ pool, level, rng }) => {
    const wantYes = rng.next() < 0.5;
    const a = rng.pick(pool);
    const others = pool.filter((square) => square !== a);
    if (wantYes) {
      const b = rng.pick(others.filter((square) => sharedDiagonal(a, square)));
      return { kind: "same_diagonal", a, b, expected: "yes" };
    }
    let misses = others.filter((square) => !sharedDiagonal(a, square));
    if (level >= TRICKY_LEVEL) {
      const sameColour = misses.filter((square) => squareColour(square) === squareColour(a));
      const near = sameColour.filter((square) => diagonalGap(a, square) === 2);
      misses = near.length > 0 ? near : sameColour;
    }
    return { kind: "same_diagonal", a, b: rng.pick(misses), expected: "no" };
  },
  isCorrect: (question, answer) =>
    typeof answer === "string" && answer.trim().toLowerCase() === question.expected,
  describe: (question) => `Are ${question.a} and ${question.b} on the same diagonal?`,
  expectedText: (question) => {
    const diagonal = sharedDiagonal(question.a, question.b);
    if (!diagonal) return "No — different diagonals";
    return `Yes — both on the ${diagonal[0]}–${diagonal[diagonal.length - 1]} diagonal`;
  },
};
