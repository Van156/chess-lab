/**
 * Question shapes for the drills that live in their own modules (`lib/drills/*`). The original four
 * drills keep their shapes in `../questions.ts`; that file unions both lists into `Question`.
 */
import type { Rng } from "../rng";
import type { Square } from "../squares";

/** What the player gives back: a colour, a yes/no, a square or SAN move, a set of squares, or a count. */
export type Answer = string | number | readonly string[];

/** Yes/no drills answer with these two strings so `Answer` stays a plain union. */
export type YesNo = "yes" | "no";

export type PieceColour = "white" | "black";
/** Upper-case piece letter as in SAN: K Q R B N, and P for a pawn. */
export type PieceLetter = "K" | "Q" | "R" | "B" | "N" | "P";
export type PlacedPiece = { colour: PieceColour; piece: PieceLetter; square: Square };

/** "Are b2 and g7 on the same diagonal?" */
export type SameDiagonalQuestion = {
  kind: "same_diagonal";
  a: Square;
  b: Square;
  expected: YesNo;
};

/** A piece list is read aloud; "Is the white king in check?" */
export type CheckDetectionQuestion = {
  kind: "check_detection";
  pieces: readonly PlacedPiece[];
  /** The side whose king is asked about. */
  king: PieceColour;
  expected: YesNo;
  /** Squares of the pieces giving check (empty when there is none), for the feedback. */
  checkers: readonly Square[];
};

/** A move sequence from the start is read out; "What stands on f3 now?" */
export type PositionRecallQuestion = {
  kind: "position_recall";
  /** SAN moves from the initial position, White first. */
  moves: readonly string[];
  square: Square;
  /** `"wN"`-style code (colour initial + piece letter), or `"empty"`. */
  expected: string;
};

/** A piece list with the side to move; "Find mate in one." The answer is typed SAN. */
export type MateInOneQuestion = {
  kind: "mate_in_one";
  fen: string;
  pieces: readonly PlacedPiece[];
  toMove: PieceColour;
  /** Every mating move in SAN (usually one), without `+`/`#` suffixes. */
  expected: readonly string[];
};

export type ExtraQuestion =
  | SameDiagonalQuestion
  | CheckDetectionQuestion
  | PositionRecallQuestion
  | MateInOneQuestion;

export type GenerateContext = {
  /** Squares allowed at this level (the a-d half at level 1, the whole board from level 2). */
  pool: readonly Square[];
  level: number;
  rng: Rng;
};

/** Everything `questions.ts` and `question-text.ts` need from one drill module. */
export type DrillModule<Q> = {
  generate: (context: GenerateContext) => Q;
  /** Case and whitespace insensitive where text is typed. */
  isCorrect: (question: Q, answer: Answer) => boolean;
  /** The prompt shown above the answer controls. */
  describe: (question: Q) => string;
  /** The right answer as text, for the feedback. */
  expectedText: (question: Q) => string;
};
