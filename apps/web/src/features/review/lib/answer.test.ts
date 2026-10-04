import { describe, expect, test } from "bun:test";

import { answerArrow, answerHighlights, gradeFromKey, matchesAnswer } from "./answer";

const answers = [{ san: "Nf3", uci: "g1f3" }];

describe("matchesAnswer", () => {
  test("matches the accepted SAN, ignoring check marks and annotations", () => {
    expect(matchesAnswer(answers, "Nf3")).toBe(true);
    expect(matchesAnswer([{ san: "Qxf7+", uci: "d1f7" }], "Qxf7")).toBe(true);
    expect(matchesAnswer(answers, "Nf3!?")).toBe(true);
  });

  test("rejects another move and an empty list of answers", () => {
    expect(matchesAnswer(answers, "e4")).toBe(false);
    expect(matchesAnswer([], "Nf3")).toBe(false);
  });
});

describe("answer arrow and highlights", () => {
  test("draws the first answer from its UCI squares", () => {
    expect(answerArrow(answers)).toEqual([{ from: "g1", to: "f3" }]);
    expect(answerHighlights(answers)).toEqual(["g1", "f3"]);
  });

  test("draws nothing without an answer", () => {
    expect(answerArrow([])).toEqual([]);
    expect(answerHighlights([])).toEqual([]);
  });
});

describe("gradeFromKey", () => {
  test("maps 1 to 4 to Again, Hard, Good, Easy", () => {
    expect([1, 2, 3, 4].map((key) => gradeFromKey(String(key)))).toEqual([1, 2, 3, 4]);
  });

  test("ignores every other key", () => {
    for (const key of ["0", "5", "a", "Enter", " ", ""]) expect(gradeFromKey(key)).toBeNull();
  });
});
