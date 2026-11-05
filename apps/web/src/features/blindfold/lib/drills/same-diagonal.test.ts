import { describe, expect, test } from "bun:test";

import { createRng } from "../rng";
import { ALL_SQUARES, parseSquare, squareColour } from "../squares";
import { sameDiagonal, sharedDiagonal } from "./same-diagonal";
import type { SameDiagonalQuestion } from "./types";

const HALF_BOARD = ALL_SQUARES.filter((square) => (parseSquare(square)?.file ?? 9) <= 3);
const poolFor = (level: number) => (level === 1 ? HALF_BOARD : ALL_SQUARES);

function generate(level: number, seed: number, count = 200): SameDiagonalQuestion[] {
  const rng = createRng(seed);
  const pool = poolFor(level);
  return Array.from({ length: count }, () => sameDiagonal.generate({ pool, level, rng }));
}

describe("sharedDiagonal", () => {
  test("finds the diagonal two squares share", () => {
    expect(sharedDiagonal("b2", "g7")).toEqual(["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]);
    expect(sharedDiagonal("g7", "b2")).toEqual(sharedDiagonal("b2", "g7"));
    expect(sharedDiagonal("a8", "h1")?.[0]).toBe("a8");
    expect(sharedDiagonal("c1", "a3")).toEqual(["a3", "b2", "c1"]);
    expect(sharedDiagonal("d4", "f2")).toEqual(["a7", "b6", "c5", "d4", "e3", "f2", "g1"]);
  });

  test("is null for squares off a common diagonal, including same-colour near misses", () => {
    for (const [a, b] of [
      ["b1", "d1"],
      ["a1", "b3"],
      ["c4", "e4"],
      ["e4", "e4"],
      ["a1", "h7"],
    ] as const) {
      expect(sharedDiagonal(a, b)).toBeNull();
    }
  });
});

describe("sameDiagonal.generate", () => {
  test("answers match the geometry, with two different squares", () => {
    for (const level of [1, 2, 3]) {
      for (const question of generate(level, level * 7)) {
        expect(question.kind).toBe("same_diagonal");
        expect(question.a).not.toBe(question.b);
        expect(question.expected).toBe(sharedDiagonal(question.a, question.b) ? "yes" : "no");
      }
    }
  });

  test("level 1 keeps both squares on the a-d half; level 2 uses the whole board", () => {
    const level1 = generate(1, 3).flatMap((question) => [question.a, question.b]);
    expect(level1.every((square) => HALF_BOARD.includes(square))).toBe(true);
    const level2 = generate(2, 3).flatMap((question) => [question.a, question.b]);
    expect(level2.some((square) => !HALF_BOARD.includes(square))).toBe(true);
  });

  test("about half the answers are yes", () => {
    for (const level of [1, 2, 3]) {
      for (const seed of [1, 2, 3]) {
        const yes = generate(level, seed).filter((question) => question.expected === "yes").length;
        expect(yes).toBeGreaterThanOrEqual(70);
        expect(yes).toBeLessThanOrEqual(130);
      }
    }
  });

  test("from level 2 a no is a same-colour near miss", () => {
    for (const level of [2, 3]) {
      for (const question of generate(level, 9)) {
        if (question.expected === "yes") continue;
        expect(squareColour(question.a)).toBe(squareColour(question.b));
      }
    }
  });

  test("is deterministic per seed and differs between seeds", () => {
    expect(generate(2, 42, 20)).toEqual(generate(2, 42, 20));
    expect(generate(2, 42, 20)).not.toEqual(generate(2, 43, 20));
  });
});

describe("sameDiagonal text and checking", () => {
  const yes: SameDiagonalQuestion = { kind: "same_diagonal", a: "b2", b: "g7", expected: "yes" };
  const no: SameDiagonalQuestion = { kind: "same_diagonal", a: "b1", b: "d1", expected: "no" };

  test("isCorrect ignores case and whitespace and rejects other answer types", () => {
    expect(sameDiagonal.isCorrect(yes, " YES ")).toBe(true);
    expect(sameDiagonal.isCorrect(yes, "no")).toBe(false);
    expect(sameDiagonal.isCorrect(no, "No")).toBe(true);
    expect(sameDiagonal.isCorrect(no, 0)).toBe(false);
    expect(sameDiagonal.isCorrect(no, ["no"])).toBe(false);
  });

  test("describes the question and the answer", () => {
    expect(sameDiagonal.describe(yes)).toBe("Are b2 and g7 on the same diagonal?");
    expect(sameDiagonal.expectedText(yes)).toBe("Yes — both on the a1–h8 diagonal");
    expect(sameDiagonal.expectedText(no)).toBe("No — different diagonals");
  });
});
