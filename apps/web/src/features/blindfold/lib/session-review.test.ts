import { describe, expect, test } from "bun:test";

import { startSession } from "./drill-session";
import { describeExpected, describeQuestion } from "./question-text";
import type { Question } from "./questions";
import { buildReview, formatAnswer } from "./session-review";

const squareColour: Question = { kind: "square_colour", square: "f6", expected: "dark" };
const knight: Question = { kind: "knight_distance", from: "b1", to: "f7", expected: 3 };
const diagonal: Question = {
  kind: "diagonals",
  square: "c3",
  direction: "rising",
  expected: ["a1", "b2", "c3", "d4"],
};

describe("buildReview", () => {
  test("pairs each answered question with the right and the given answer", () => {
    const review = buildReview({
      questions: [squareColour, knight, diagonal],
      results: [true, false],
      answers: ["dark", 4],
    });
    expect(review).toEqual([
      {
        prompt: describeQuestion(squareColour),
        expected: "dark",
        given: "dark",
        correct: true,
      },
      { prompt: describeQuestion(knight), expected: "3", given: "4", correct: false },
    ]);
  });

  test("works on a real session and stops at the last answered question", () => {
    const session = startSession({ kind: "diagonals", level: 1, seed: 3, now: 0, count: 5 });
    const review = buildReview({ ...session, results: [false], answers: [["a1", "b2"]] });
    expect(review).toHaveLength(1);
    expect(review[0]!.expected).toBe(describeExpected(session.questions[0]!));
    expect(review[0]!.given).toBe("a1 b2");
  });

  test("shows No answer when answers were not recorded", () => {
    const review = buildReview({ questions: [squareColour], results: [false] });
    expect(review[0]!.given).toBe("No answer");
  });
});

describe("formatAnswer", () => {
  test("formats each answer shape as text", () => {
    expect(formatAnswer(knight, 2)).toBe("2");
    expect(formatAnswer(diagonal, ["a1", "c3"])).toBe("a1 c3");
    expect(formatAnswer(diagonal, [])).toBe("No answer");
    expect(formatAnswer(squareColour, "  ")).toBe("No answer");
  });

  test("capitalises yes and no", () => {
    const question: Question = { kind: "same_diagonal", a: "b2", b: "g7", expected: "yes" };
    expect(formatAnswer(question, "yes")).toBe("Yes");
    expect(formatAnswer(question, "no")).toBe("No");
    const [item] = buildReview({ questions: [question], results: [true], answers: ["yes"] });
    expect(item!.expected.startsWith("Yes")).toBe(true);
  });

  test("names pieces for position recall", () => {
    const question: Question = {
      kind: "position_recall",
      moves: ["e4"],
      square: "e4",
      expected: "wP",
    };
    expect(formatAnswer(question, "wN")).toBe("White knight");
    expect(formatAnswer(question, "bq")).toBe("Black queen");
    expect(formatAnswer(question, "empty")).toBe("Empty");
  });
});
