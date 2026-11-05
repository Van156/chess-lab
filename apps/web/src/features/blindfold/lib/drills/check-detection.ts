// STUB: replaced by the real drill module.
import type { CheckDetectionQuestion, DrillModule } from "./types";

export const checkDetection: DrillModule<CheckDetectionQuestion> = {
  generate: ({ pool, rng }) => ({
    kind: "check_detection",
    pieces: [
      { colour: "white", piece: "K", square: rng.pick(pool) },
      { colour: "black", piece: "K", square: "h8" },
    ],
    king: "white",
    expected: "no",
    checkers: [],
  }),
  isCorrect: (question, answer) => answer === question.expected,
  describe: () => "Is the white king in check?",
  expectedText: (question) => question.expected,
};
