import { describe, expect, test } from "bun:test";
import { Chess } from "chess.js";

import { createRng } from "../rng";
import { ALL_SQUARES } from "../squares";
import { piecesFromFen } from "./fen";
import { MATE_POSITIONS } from "./mate-positions";
import { mateInOne } from "./mate-in-one";
import type { MateInOneQuestion } from "./types";

const generate = (level: number, seed: number, count: number): MateInOneQuestion[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => mateInOne.generate({ pool: ALL_SQUARES, level, rng }));
};

const levelOf = (fen: string): number | undefined =>
  MATE_POSITIONS.find((position) => position.fen === fen)?.level;

describe("mateInOne.generate", () => {
  test("picks a curated position for the level; levels above 3 reuse level 3", () => {
    for (const level of [1, 2, 3]) {
      for (const question of generate(level, 2, 40)) expect(levelOf(question.fen)).toBe(level);
    }
    for (const question of generate(6, 2, 40)) expect(levelOf(question.fen)).toBe(3);
  });

  test("fills pieces, side to move and every mating move", () => {
    for (const question of generate(2, 5, 60)) {
      expect(question.kind).toBe("mate_in_one");
      expect(question.pieces).toEqual(piecesFromFen(question.fen));
      expect(question.toMove).toBe(question.fen.split(" ")[1] === "w" ? "white" : "black");
      const mates = new Chess(question.fen)
        .moves()
        .filter((san) => san.endsWith("#"))
        .map((san) => san.slice(0, -1));
      expect([...question.expected].sort()).toEqual(mates.sort());
      expect(question.expected.every((san) => !/[+#]/.test(san))).toBe(true);
    }
  });

  test("varies the positions and is deterministic for a seed", () => {
    const questions = generate(1, 11, 20);
    expect(new Set(questions.map((question) => question.fen)).size).toBeGreaterThan(5);
    expect(generate(1, 11, 20)).toEqual(questions);
    expect(generate(1, 12, 20)).not.toEqual(questions);
  });
});

describe("mateInOne.isCorrect", () => {
  const backRank: MateInOneQuestion = {
    kind: "mate_in_one",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    pieces: piecesFromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"),
    toMove: "white",
    expected: ["Ra8"],
  };
  const pawnMate: MateInOneQuestion = {
    kind: "mate_in_one",
    fen: "k7/p1K5/1P6/8/8/8/8/8 w - - 0 1",
    pieces: piecesFromFen("k7/p1K5/1P6/8/8/8/8/8 w - - 0 1"),
    toMove: "white",
    expected: ["b7"],
  };
  const promotion: MateInOneQuestion = {
    kind: "mate_in_one",
    fen: "8/6Pp/5K1k/7p/8/8/8/8 w - - 0 1",
    pieces: piecesFromFen("8/6Pp/5K1k/7p/8/8/8/8 w - - 0 1"),
    toMove: "white",
    expected: ["g8=N"],
  };

  test("accepts SAN with or without check marks, and a lower-case piece letter", () => {
    for (const answer of ["Ra8", "Ra8#", "Ra8+", " ra8 ", "R1a8"]) {
      expect(mateInOne.isCorrect(backRank, answer), answer).toBe(true);
    }
  });

  test("accepts coordinate notation", () => {
    expect(mateInOne.isCorrect(backRank, "a1a8")).toBe(true);
    expect(mateInOne.isCorrect(backRank, "a1-a8")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g7g8n")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g7g8q")).toBe(false);
  });

  test("reads a lower-case b as a pawn file, and lower-case promotion pieces", () => {
    expect(mateInOne.isCorrect(pawnMate, "b7")).toBe(true);
    expect(mateInOne.isCorrect(pawnMate, "b7#")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g8=N")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g8=n")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g8N")).toBe(true);
    expect(mateInOne.isCorrect(promotion, "g8=Q")).toBe(false);
  });

  test("rejects legal moves that do not mate, illegal moves, junk and non-strings", () => {
    expect(mateInOne.isCorrect(backRank, "Ra7")).toBe(false);
    expect(mateInOne.isCorrect(backRank, "Qa8")).toBe(false);
    expect(mateInOne.isCorrect(backRank, "Kh1")).toBe(false);
    expect(mateInOne.isCorrect(backRank, "")).toBe(false);
    expect(mateInOne.isCorrect(backRank, "hello")).toBe(false);
    expect(mateInOne.isCorrect(backRank, 3)).toBe(false);
    expect(mateInOne.isCorrect(backRank, ["Ra8"])).toBe(false);
  });

  test("accepts any of several mating moves", () => {
    const queen: MateInOneQuestion = {
      kind: "mate_in_one",
      fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",
      pieces: piecesFromFen("7k/Q7/6K1/8/8/8/8/8 w - - 0 1"),
      toMove: "white",
      expected: ["Qa8", "Qb8", "Qg7", "Qh7"],
    };
    for (const answer of ["Qa8", "qb8", "Qg7#", "a7h7"]) {
      expect(mateInOne.isCorrect(queen, answer), answer).toBe(true);
    }
    expect(mateInOne.isCorrect(queen, "Qc7")).toBe(false);
  });
});

describe("mateInOne text", () => {
  const question: MateInOneQuestion = {
    kind: "mate_in_one",
    fen: "8/8/8/8/8/1k6/7r/K7 b - - 0 1",
    pieces: piecesFromFen("8/8/8/8/8/1k6/7r/K7 b - - 0 1"),
    toMove: "black",
    expected: ["Rh1"],
  };

  test("names the side to move and gives the mates with #", () => {
    expect(mateInOne.describe(question)).toBe("Black to move. Find mate in one.");
    expect(mateInOne.describe({ ...question, toMove: "white" })).toBe(
      "White to move. Find mate in one.",
    );
    expect(mateInOne.expectedText(question)).toBe("Rh1#");
    expect(mateInOne.expectedText({ ...question, expected: ["Qb2", "Qa2"] })).toBe("Qb2# or Qa2#");
  });
});
