/** Hand-built questions for the stories and tests, independent of the generators. */
import { piecesFromFen } from "../../lib/drills/fen";
import type {
  CheckDetectionQuestion,
  ExtraQuestion,
  MateInOneQuestion,
  PlacedPiece,
  PositionRecallQuestion,
  SameDiagonalQuestion,
} from "../../lib/drills/types";

export const SAME_DIAGONAL_YES: SameDiagonalQuestion = {
  kind: "same_diagonal",
  a: "b2",
  b: "g7",
  expected: "yes",
};

/** Different colours: the quickest way to say no. */
export const SAME_DIAGONAL_NO: SameDiagonalQuestion = {
  kind: "same_diagonal",
  a: "c1",
  b: "f5",
  expected: "no",
};

/** Same colour, still no shared diagonal. */
export const SAME_DIAGONAL_SAME_COLOUR: SameDiagonalQuestion = {
  kind: "same_diagonal",
  a: "b1",
  b: "e6",
  expected: "no",
};

const CHECK_WHITE: readonly PlacedPiece[] = [
  { colour: "white", piece: "K", square: "g1" },
  { colour: "white", piece: "Q", square: "d2" },
  { colour: "white", piece: "R", square: "f1" },
  { colour: "white", piece: "N", square: "c3" },
  { colour: "white", piece: "P", square: "a2" },
  { colour: "white", piece: "P", square: "b2" },
  { colour: "white", piece: "P", square: "g2" },
  { colour: "white", piece: "P", square: "h2" },
];

const CHECK_BLACK: readonly PlacedPiece[] = [
  { colour: "black", piece: "K", square: "g8" },
  { colour: "black", piece: "Q", square: "d8" },
  { colour: "black", piece: "R", square: "f8" },
  { colour: "black", piece: "P", square: "a7" },
  { colour: "black", piece: "P", square: "f7" },
  { colour: "black", piece: "P", square: "g7" },
  { colour: "black", piece: "P", square: "h7" },
];

export const CHECK_YES: CheckDetectionQuestion = {
  kind: "check_detection",
  pieces: [...CHECK_WHITE, ...CHECK_BLACK, { colour: "black", piece: "B", square: "c5" }],
  king: "white",
  expected: "yes",
  checkers: ["c5"],
};

export const CHECK_NO: CheckDetectionQuestion = {
  kind: "check_detection",
  pieces: [...CHECK_WHITE, ...CHECK_BLACK, { colour: "black", piece: "B", square: "e7" }],
  king: "white",
  expected: "no",
  checkers: [],
};

const RUY_LOPEZ = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"] as const;

export const RECALL_PIECE: PositionRecallQuestion = {
  kind: "position_recall",
  moves: RUY_LOPEZ,
  square: "f6",
  expected: "bN",
};

export const RECALL_EMPTY: PositionRecallQuestion = {
  kind: "position_recall",
  moves: RUY_LOPEZ,
  square: "b5",
  expected: "empty",
};

const BACK_RANK_FEN = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";

export const MATE_BACK_RANK: MateInOneQuestion = {
  kind: "mate_in_one",
  fen: BACK_RANK_FEN,
  pieces: piecesFromFen(BACK_RANK_FEN),
  toMove: "white",
  expected: ["Ra8"],
};

const BLACK_MATES_FEN = "r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1";

/** The mirror image, Black to move: Ra1 mates. */
export const MATE_BLACK_TO_MOVE: MateInOneQuestion = {
  kind: "mate_in_one",
  fen: BLACK_MATES_FEN,
  pieces: piecesFromFen(BLACK_MATES_FEN),
  toMove: "black",
  expected: ["Ra1"],
};

/** The prompt each fixture would carry (the drill modules write the real ones). */
export function promptFor(question: ExtraQuestion): string {
  switch (question.kind) {
    case "same_diagonal":
      return `Are ${question.a} and ${question.b} on the same diagonal?`;
    case "check_detection":
      return `Is the ${question.king} king in check?`;
    case "position_recall":
      return `What stands on ${question.square} now?`;
    case "mate_in_one":
      return "Find mate in one.";
  }
}
