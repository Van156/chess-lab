import { describe, expect, test } from "bun:test";

import { DRILL_KINDS, generateQuestions, isCorrect, type Question } from "./questions";
import { diagonalsThrough, knightDistance, parseSquare, squareColour } from "./squares";

const options = (kind: (typeof DRILL_KINDS)[number], level = 1, seed = 1) => ({
  kind,
  level,
  seed,
});

describe("generateQuestions", () => {
  test("lists the four drill kinds", () => {
    expect([...DRILL_KINDS]).toEqual([
      "square_colour",
      "coordinates",
      "diagonals",
      "knight_distance",
    ]);
  });

  test("returns 20 questions by default, of the requested kind", () => {
    for (const kind of DRILL_KINDS) {
      const questions = generateQuestions(options(kind));
      expect(questions).toHaveLength(20);
      expect(questions.every((question) => question.kind === kind)).toBe(true);
    }
  });

  test("honours a custom count", () => {
    expect(generateQuestions({ ...options("square_colour"), count: 5 })).toHaveLength(5);
  });

  test("is deterministic for a seed and differs across seeds", () => {
    for (const kind of DRILL_KINDS) {
      const a = generateQuestions(options(kind, 1, 11));
      expect(generateQuestions(options(kind, 1, 11))).toEqual(a);
      expect(generateQuestions(options(kind, 1, 12))).not.toEqual(a);
    }
  });

  test("level 1 stays on the a-d half of the board; level 2 uses the whole board", () => {
    const squaresOf = (question: Question) =>
      question.kind === "knight_distance" ? [question.from, question.to] : [question.square];
    const maxFile = (level: number) =>
      Math.max(
        ...DRILL_KINDS.flatMap((kind) =>
          generateQuestions({ ...options(kind, level, 5), count: 200 }).flatMap(squaresOf),
        ).map((square) => parseSquare(square)?.file ?? -1),
      );
    expect(maxFile(1)).toBeLessThanOrEqual(3);
    expect(maxFile(2)).toBeGreaterThan(3);
  });
});

describe("square colour questions", () => {
  test("the expected answer matches the square colour", () => {
    for (const question of generateQuestions({ ...options("square_colour", 2), count: 64 })) {
      if (question.kind !== "square_colour") throw new Error("wrong kind");
      expect(question.expected).toBe(squareColour(question.square));
      expect(isCorrect(question, question.expected)).toBe(true);
      expect(isCorrect(question, question.expected === "dark" ? "light" : "dark")).toBe(false);
    }
  });
});

describe("coordinates questions", () => {
  test("accepts the square name regardless of case and whitespace", () => {
    const [question] = generateQuestions({ ...options("coordinates"), count: 1 });
    if (question?.kind !== "coordinates") throw new Error("wrong kind");
    expect(question.expected).toBe(question.square);
    expect(isCorrect(question, ` ${question.square.toUpperCase()} `)).toBe(true);
    expect(isCorrect(question, "zz")).toBe(false);
  });
});

describe("diagonals questions", () => {
  test("the expected answer is the chosen diagonal through the square", () => {
    for (const question of generateQuestions({ ...options("diagonals", 2), count: 40 })) {
      if (question.kind !== "diagonals") throw new Error("wrong kind");
      expect(question.expected).toEqual(diagonalsThrough(question.square)[question.direction]);
      expect(question.expected.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("answers are order-insensitive sets and must be exact", () => {
    const [question] = generateQuestions({ ...options("diagonals"), count: 1 });
    if (question?.kind !== "diagonals") throw new Error("wrong kind");
    expect(isCorrect(question, [...question.expected].reverse())).toBe(true);
    expect(isCorrect(question, question.expected.slice(1))).toBe(false);
    expect(isCorrect(question, [...question.expected, "h5x"])).toBe(false);
  });
});

describe("knight distance questions", () => {
  test("the expected answer is the BFS distance between two distinct squares", () => {
    for (const question of generateQuestions({ ...options("knight_distance", 2), count: 40 })) {
      if (question.kind !== "knight_distance") throw new Error("wrong kind");
      expect(question.from).not.toBe(question.to);
      expect(question.expected).toBe(knightDistance(question.from, question.to));
      expect(isCorrect(question, question.expected)).toBe(true);
      expect(isCorrect(question, question.expected + 1)).toBe(false);
    }
  });

  test("level 1 keeps distances short (at most 3)", () => {
    for (const question of generateQuestions({ ...options("knight_distance", 1), count: 100 })) {
      if (question.kind !== "knight_distance") throw new Error("wrong kind");
      expect(question.expected).toBeLessThanOrEqual(3);
    }
  });
});
