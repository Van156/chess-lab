// STUB: replaced by the real drill module.
import type { DrillModule, PositionRecallQuestion } from "./types";

export const positionRecall: DrillModule<PositionRecallQuestion> = {
  generate: ({ pool, rng }) => ({
    kind: "position_recall",
    moves: ["e4", "e5"],
    square: rng.pick(pool),
    expected: "empty",
  }),
  isCorrect: (question, answer) => answer === question.expected,
  describe: (question) => `What stands on ${question.square} now?`,
  expectedText: (question) => question.expected,
};
