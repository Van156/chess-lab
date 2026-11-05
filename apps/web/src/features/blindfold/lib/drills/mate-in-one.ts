// STUB: replaced by the real drill module.
import type { DrillModule, MateInOneQuestion } from "./types";

export const mateInOne: DrillModule<MateInOneQuestion> = {
  generate: ({ rng }) => ({
    kind: "mate_in_one",
    fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    pieces: [],
    toMove: rng.next() < 2 ? "white" : "black",
    expected: ["Ra8"],
  }),
  isCorrect: (question, answer) =>
    typeof answer === "string" && question.expected.includes(answer.trim()),
  describe: () => "Find mate in one.",
  expectedText: (question) => question.expected.join(" or "),
};
