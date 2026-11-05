import { describe, expect, test } from "bun:test";

import { describeExpected, describeQuestion, parseSquareList } from "./question-text";
import type { Question } from "./questions";

describe("describeQuestion", () => {
  test("phrases each drill kind as a question", () => {
    expect(describeQuestion({ kind: "square_colour", square: "f6", expected: "dark" })).toBe(
      "Is f6 light or dark?",
    );
    expect(describeQuestion({ kind: "coordinates", square: "e4", expected: "e4" })).toBe(
      "Type the name of the highlighted square.",
    );
    expect(describeQuestion({ kind: "knight_distance", from: "b1", to: "f7", expected: 4 })).toBe(
      "Fewest knight moves from b1 to f7?",
    );
  });

  test("names the diagonal direction and asks for every square, the given one included", () => {
    const rising: Question = {
      kind: "diagonals",
      square: "c3",
      direction: "rising",
      expected: ["a1", "b2", "c3"],
    };
    expect(describeQuestion(rising)).toBe(
      "List every square on the a1-h8 style diagonal through c3, including it.",
    );
    expect(describeQuestion({ ...rising, direction: "falling" })).toBe(
      "List every square on the a8-h1 style diagonal through c3, including it.",
    );
  });
});

describe("describeExpected", () => {
  test("renders the right answer for each kind", () => {
    expect(describeExpected({ kind: "square_colour", square: "f6", expected: "dark" })).toBe(
      "dark",
    );
    expect(describeExpected({ kind: "coordinates", square: "e4", expected: "e4" })).toBe("e4");
    expect(
      describeExpected({
        kind: "diagonals",
        square: "c3",
        direction: "rising",
        expected: ["a1", "b2"],
      }),
    ).toBe("a1 b2");
    expect(describeExpected({ kind: "knight_distance", from: "b1", to: "f7", expected: 4 })).toBe(
      "4",
    );
  });
});

describe("parseSquareList", () => {
  test("splits on spaces and commas and drops empties", () => {
    expect(parseSquareList("a1, b2  c3,,d4 ")).toEqual(["a1", "b2", "c3", "d4"]);
    expect(parseSquareList("   ")).toEqual([]);
  });
});
