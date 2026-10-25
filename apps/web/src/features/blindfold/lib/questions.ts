import { createRng, type Rng } from "./rng";
import {
  ALL_SQUARES,
  diagonalsThrough,
  knightDistance,
  parseSquare,
  squareColour,
  type Square,
  type SquareColour,
} from "./squares";

/** Mirrors `DrillKind` in `@b2c-template/db`; the API validates the same four values. */
export const DRILL_KINDS = [
  "square_colour",
  "coordinates",
  "diagonals",
  "knight_distance",
] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

export type DiagonalDirection = "rising" | "falling";

export type Question =
  | { kind: "square_colour"; square: Square; expected: SquareColour }
  | { kind: "coordinates"; square: Square; expected: Square }
  | {
      kind: "diagonals";
      square: Square;
      direction: DiagonalDirection;
      /** Every square on the chosen diagonal through `square`, ordered by file. */
      expected: Square[];
    }
  | { kind: "knight_distance"; from: Square; to: Square; expected: number };

/** What the player gives back: a colour or square name, a set of squares, or a move count. */
export type Answer = string | number | readonly string[];

export type GenerateOptions = {
  kind: DrillKind;
  seed: number;
  /** 1 = squares on the a-d half of the board and knight distances up to 3; 2 and above = the whole board. */
  level: number;
  /** Defaults to a 20-question session. */
  count?: number;
};

export const DEFAULT_QUESTION_COUNT = 20;
const LEVEL_ONE_MAX_KNIGHT_DISTANCE = 3;

function squarePool(level: number): readonly Square[] {
  if (level >= 2) return ALL_SQUARES;
  return ALL_SQUARES.filter((square) => (parseSquare(square)?.file ?? 0) <= 3);
}

function generateOne(kind: DrillKind, pool: readonly Square[], level: number, rng: Rng): Question {
  switch (kind) {
    case "square_colour": {
      const square = rng.pick(pool);
      return { kind, square, expected: squareColour(square) };
    }
    case "coordinates": {
      const square = rng.pick(pool);
      return { kind, square, expected: square };
    }
    case "diagonals": {
      const square = rng.pick(pool);
      const direction: DiagonalDirection = rng.next() < 0.5 ? "rising" : "falling";
      const expected = diagonalsThrough(square)[direction];
      // A single-square "diagonal" (a corner) is no question; use the other, always longer, one.
      const usable =
        expected.length >= 2 ? direction : direction === "rising" ? "falling" : "rising";
      return {
        kind,
        square,
        direction: usable,
        expected: diagonalsThrough(square)[usable],
      };
    }
    case "knight_distance": {
      const from = rng.pick(pool);
      const maxDistance = level >= 2 ? Number.POSITIVE_INFINITY : LEVEL_ONE_MAX_KNIGHT_DISTANCE;
      const targets = pool.filter((to) => {
        const distance = knightDistance(from, to);
        return distance >= 1 && distance <= maxDistance;
      });
      const to = rng.pick(targets);
      return { kind, from, to, expected: knightDistance(from, to) };
    }
  }
}

/** Generates a deterministic list of questions for one drill session. */
export function generateQuestions({
  kind,
  seed,
  level,
  count = DEFAULT_QUESTION_COUNT,
}: GenerateOptions): Question[] {
  const rng = createRng(seed);
  const pool = squarePool(level);
  return Array.from({ length: count }, () => generateOne(kind, pool, level, rng));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const normalised = new Set(a.map((square) => square.trim().toLowerCase()));
  return normalised.size === b.length && b.every((square) => normalised.has(square));
}

/** Whether an answer is right for a question. Squares ignore case and whitespace; diagonals ignore order. */
export function isCorrect(question: Question, answer: Answer): boolean {
  switch (question.kind) {
    case "square_colour":
      return typeof answer === "string" && answer.trim().toLowerCase() === question.expected;
    case "coordinates":
      return typeof answer === "string" && answer.trim().toLowerCase() === question.expected;
    case "diagonals":
      return (
        typeof answer !== "string" &&
        typeof answer !== "number" &&
        sameSet(answer, question.expected)
      );
    case "knight_distance":
      return answer === question.expected;
  }
}
