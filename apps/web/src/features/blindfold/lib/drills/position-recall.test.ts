import { describe, expect, test } from "bun:test";
import { Chess } from "chess.js";

import { createRng } from "../rng";
import { ALL_SQUARES } from "../squares";
import { OPENING_LINES } from "./opening-lines";
import { positionRecall } from "./position-recall";
import type { PositionRecallQuestion } from "./types";

const generate = (level: number, seed: number, count: number): PositionRecallQuestion[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () =>
    positionRecall.generate({ pool: ALL_SQUARES, level, rng }),
  );
};

function occupant(moves: readonly string[], square: string): string {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  const piece = chess.get(square as never);
  return piece ? `${piece.color}${piece.type.toUpperCase()}` : "empty";
}

describe("positionRecall.generate", () => {
  test("plays a prefix of a known opening line", () => {
    for (const question of generate(3, 1, 60)) {
      expect(question.kind).toBe("position_recall");
      const source = OPENING_LINES.find((line) =>
        question.moves.every((move, index) => line.moves[index] === move),
      );
      expect(source).toBeDefined();
    }
  });

  test("the number of plies grows with the level", () => {
    const range = (level: number) => {
      const lengths = generate(level, 3, 200).map((question) => question.moves.length);
      return [Math.min(...lengths), Math.max(...lengths)];
    };
    expect(range(1)).toEqual([4, 6]);
    expect(range(2)).toEqual([8, 10]);
    expect(range(3)).toEqual([12, 16]);
    expect(range(7)).toEqual([12, 16]);
  });

  test("the expected answer is what stands on the square after the moves", () => {
    for (const level of [1, 2, 3]) {
      for (const question of generate(level, 4, 80)) {
        expect(question.expected).toBe(occupant(question.moves, question.square));
      }
    }
  });

  test("about a quarter of the answers are empty, the rest are pieces", () => {
    const questions = generate(2, 9, 400);
    const empty = questions.filter((question) => question.expected === "empty").length / 400;
    expect(empty).toBeGreaterThan(0.15);
    expect(empty).toBeLessThan(0.35);
  });

  test("mostly asks about squares the moves touched", () => {
    const questions = generate(2, 21, 300);
    const touched = questions.filter((question) => {
      const chess = new Chess();
      return question.moves.some((move) => {
        const played = chess.move(move);
        return played.from === question.square || played.to === question.square;
      });
    }).length;
    expect(touched / questions.length).toBeGreaterThan(0.7);
    expect(touched).toBeLessThan(questions.length);
  });

  test("is deterministic for a seed", () => {
    expect(generate(2, 11, 20)).toEqual(generate(2, 11, 20));
    expect(generate(2, 12, 20)).not.toEqual(generate(2, 11, 20));
  });
});

describe("positionRecall answers and text", () => {
  const question: PositionRecallQuestion = {
    kind: "position_recall",
    moves: ["e4", "e5", "Nf3", "Nc6"],
    square: "f3",
    expected: "wN",
  };
  const empty: PositionRecallQuestion = { ...question, square: "g1", expected: "empty" };

  test("accepts the piece code in any case", () => {
    expect(positionRecall.isCorrect(question, "wN")).toBe(true);
    expect(positionRecall.isCorrect(question, " wn ")).toBe(true);
    expect(positionRecall.isCorrect(question, "WN")).toBe(true);
    expect(positionRecall.isCorrect(question, "bN")).toBe(false);
    expect(positionRecall.isCorrect(question, "empty")).toBe(false);
    expect(positionRecall.isCorrect(empty, "Empty")).toBe(true);
    expect(positionRecall.isCorrect(empty, 0)).toBe(false);
  });

  test("describes the question and the answer", () => {
    expect(positionRecall.describe(question)).toBe("What stands on f3 now?");
    expect(positionRecall.expectedText(question)).toBe("White knight");
    expect(positionRecall.expectedText({ ...question, expected: "bP" })).toBe("Black pawn");
    expect(positionRecall.expectedText(empty)).toBe("Nothing — it is empty");
  });
});
