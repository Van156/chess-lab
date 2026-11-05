import { checkDetection } from "./drills/check-detection";
import { mateInOne } from "./drills/mate-in-one";
import { positionRecall } from "./drills/position-recall";
import { sameDiagonal } from "./drills/same-diagonal";
import type { Answer, DrillModule, ExtraQuestion } from "./drills/types";
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

/** Mirrors `DrillKind` in `@b2c-template/db`; the API validates the same values. */
export const DRILL_KINDS = [
  "square_colour",
  "coordinates",
  "diagonals",
  "knight_distance",
  "same_diagonal",
  "check_detection",
  "position_recall",
  "mate_in_one",
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
  | { kind: "knight_distance"; from: Square; to: Square; expected: number }
  | ExtraQuestion;

export type { Answer } from "./drills/types";

/** The drills implemented in their own module, keyed by kind. */
export const EXTRA_DRILLS: {
  [K in ExtraQuestion["kind"]]: DrillModule<Extract<ExtraQuestion, { kind: K }>>;
} = {
  same_diagonal: sameDiagonal,
  check_detection: checkDetection,
  position_recall: positionRecall,
  mate_in_one: mateInOne,
};

function isExtra(question: Question): question is ExtraQuestion {
  return question.kind in EXTRA_DRILLS;
}

/** The module for an extra question, typed loosely so callers need no per-kind switch. */
export function extraModule(question: ExtraQuestion): DrillModule<ExtraQuestion> {
  return EXTRA_DRILLS[question.kind] as DrillModule<ExtraQuestion>;
}

export type GenerateOptions = {
  kind: DrillKind;
  seed: number;
  /**
   * A whole number from 1. Level 1 uses the a-d half of the board and knight distances up to 3;
   * level 2 and above use the whole board. Anything else throws a `RangeError`.
   */
  level: number;
  /** A positive whole number; defaults to a 20-question session. */
  count?: number;
};

export const DEFAULT_QUESTION_COUNT = 20;
/** Levels from this one up play on the whole board with no cap on knight distance. */
export const FULL_BOARD_LEVEL = 2;
/** Files a-d (0-3) form the half board used at level 1. */
const LEVEL_ONE_MAX_FILE = 3;
const LEVEL_ONE_MAX_KNIGHT_DISTANCE = 3;

function squarePool(level: number): readonly Square[] {
  if (level >= FULL_BOARD_LEVEL) return ALL_SQUARES;
  return ALL_SQUARES.filter((square) => (parseSquare(square)?.file ?? 0) <= LEVEL_ONE_MAX_FILE);
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
      const maxDistance =
        level >= FULL_BOARD_LEVEL ? Number.POSITIVE_INFINITY : LEVEL_ONE_MAX_KNIGHT_DISTANCE;
      const targets = pool.filter((to) => {
        const distance = knightDistance(from, to);
        return distance >= 1 && distance <= maxDistance;
      });
      const to = rng.pick(targets);
      return { kind, from, to, expected: knightDistance(from, to) };
    }
    default:
      return EXTRA_DRILLS[kind].generate({ pool, level, rng });
  }
}

/**
 * Generates a deterministic list of questions for one drill session. Throws a `RangeError` for a
 * `count` that is not a positive whole number or a `level` that is not a whole number from 1.
 */
export function generateQuestions({
  kind,
  seed,
  level,
  count = DEFAULT_QUESTION_COUNT,
}: GenerateOptions): Question[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive whole number, got ${count}.`);
  }
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`level must be a whole number from 1, got ${level}.`);
  }
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
  if (isExtra(question)) return extraModule(question).isCorrect(question, answer);
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
