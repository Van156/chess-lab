// STUB: replaced by the real drill module.
import type { DrillModule, SameDiagonalQuestion } from "./types";

export const sameDiagonal: DrillModule<SameDiagonalQuestion> = {
  generate: ({ pool, rng }) => ({
    kind: "same_diagonal",
    a: rng.pick(pool),
    b: rng.pick(pool),
    expected: "no",
  }),
  isCorrect: (question, answer) => answer === question.expected,
  describe: (question) => `Are ${question.a} and ${question.b} on the same diagonal?`,
  expectedText: (question) => question.expected,
};
