import { describe, expect, test } from "bun:test";

import { createRng } from "../rng";
import { ALL_SQUARES, parseSquare } from "../squares";
import { checkers as findCheckers } from "./attacks";
import { checkDetection } from "./check-detection";
import type { CheckDetectionQuestion, PieceColour } from "./types";

const HALF_BOARD = ALL_SQUARES.filter((square) => (parseSquare(square)?.file ?? 9) <= 3);
const other = (colour: PieceColour): PieceColour => (colour === "white" ? "black" : "white");

function generate(level: number, seed: number, count = 200): CheckDetectionQuestion[] {
  const rng = createRng(seed);
  const pool = level === 1 ? HALF_BOARD : ALL_SQUARES;
  return Array.from({ length: count }, () => checkDetection.generate({ pool, level, rng }));
}

function kingsAdjacent(a: string, b: string): boolean {
  const x = parseSquare(a);
  const y = parseSquare(b);
  if (!x || !y) throw new Error("bad square");
  return Math.max(Math.abs(x.file - y.file), Math.abs(x.rank - y.rank)) <= 1;
}

describe("checkDetection.generate", () => {
  for (const level of [1, 2, 3, 4]) {
    test(`level ${level} positions look legal and the answer matches the board`, () => {
      for (const seed of [1, 2, 3]) {
        for (const question of generate(level, seed)) {
          const { pieces, king } = question;
          const squares = pieces.map((piece) => piece.square);
          expect(new Set(squares).size).toBe(squares.length);
          for (const square of squares) expect(ALL_SQUARES).toContain(square);

          const kings = pieces.filter((piece) => piece.piece === "K");
          expect(kings.filter((piece) => piece.colour === "white")).toHaveLength(1);
          expect(kings.filter((piece) => piece.colour === "black")).toHaveLength(1);
          expect(kingsAdjacent(kings[0]?.square ?? "", kings[1]?.square ?? "")).toBe(false);

          for (const pawn of pieces.filter((piece) => piece.piece === "P")) {
            expect(pawn.square.endsWith("1") || pawn.square.endsWith("8")).toBe(false);
          }

          expect(findCheckers(pieces, other(king))).toEqual([]);
          const giving = findCheckers(pieces, king).map((piece) => piece.square);
          expect(giving.length).toBeLessThanOrEqual(2);
          expect([...question.checkers].sort()).toEqual([...giving].sort());
          expect(question.expected).toBe(giving.length > 0 ? "yes" : "no");
        }
      }
    });
  }

  test("level 1 has the two kings and one enemy queen, rook, bishop or knight", () => {
    for (const question of generate(1, 5)) {
      expect(question.pieces).toHaveLength(3);
      const extra = question.pieces.find((piece) => piece.piece !== "K");
      expect(extra?.colour).toBe(other(question.king));
      expect(["Q", "R", "B", "N"]).toContain(extra?.piece ?? "");
    }
  });

  test("level 1 uses the whole board", () => {
    const squares = generate(1, 5).flatMap((question) => question.pieces.map((p) => p.square));
    expect(squares.some((square) => !HALF_BOARD.includes(square))).toBe(true);
  });

  test("level 2 adds one or two pieces and sometimes blocks a line", () => {
    const questions = generate(2, 6);
    for (const question of questions) {
      expect(question.pieces.length).toBeGreaterThanOrEqual(4);
      expect(question.pieces.length).toBeLessThanOrEqual(5);
    }
  });

  test("level 3 has 6-8 pieces with pawns and both sides' minor pieces", () => {
    for (const question of generate(3, 7)) {
      const { pieces } = question;
      expect(pieces.length).toBeGreaterThanOrEqual(6);
      expect(pieces.length).toBeLessThanOrEqual(8);
      expect(pieces.some((piece) => piece.piece === "P")).toBe(true);
      for (const colour of ["white", "black"] as const) {
        expect(
          pieces.some(
            (piece) => piece.colour === colour && (piece.piece === "B" || piece.piece === "N"),
          ),
        ).toBe(true);
      }
    }
  });

  test("asks about both kings and about half the answers are yes", () => {
    for (const level of [1, 2, 3]) {
      for (const seed of [1, 2]) {
        const questions = generate(level, seed);
        const yes = questions.filter((question) => question.expected === "yes").length;
        expect(yes).toBeGreaterThanOrEqual(70);
        expect(yes).toBeLessThanOrEqual(130);
        expect(questions.some((question) => question.king === "white")).toBe(true);
        expect(questions.some((question) => question.king === "black")).toBe(true);
      }
    }
  });

  test("is deterministic per seed and differs between seeds", () => {
    for (const level of [1, 2, 3]) {
      expect(generate(level, 42, 20)).toEqual(generate(level, 42, 20));
      expect(generate(level, 42, 20)).not.toEqual(generate(level, 43, 20));
    }
  });
});

describe("checkDetection text and checking", () => {
  const yes: CheckDetectionQuestion = {
    kind: "check_detection",
    pieces: [
      { colour: "white", piece: "K", square: "e1" },
      { colour: "black", piece: "K", square: "e8" },
      { colour: "black", piece: "B", square: "b4" },
    ],
    king: "white",
    expected: "yes",
    checkers: ["b4"],
  };
  const double: CheckDetectionQuestion = {
    kind: "check_detection",
    pieces: [
      { colour: "white", piece: "K", square: "g1" },
      { colour: "black", piece: "K", square: "g8" },
      { colour: "black", piece: "Q", square: "g4" },
      { colour: "black", piece: "P", square: "h2" },
    ],
    king: "white",
    expected: "yes",
    checkers: ["g4", "h2"],
  };
  const no: CheckDetectionQuestion = { ...yes, king: "black", expected: "no", checkers: [] };

  test("isCorrect ignores case and whitespace", () => {
    expect(checkDetection.isCorrect(yes, "  Yes")).toBe(true);
    expect(checkDetection.isCorrect(yes, "no")).toBe(false);
    expect(checkDetection.isCorrect(no, "NO ")).toBe(true);
    expect(checkDetection.isCorrect(no, 1)).toBe(false);
  });

  test("describes the question and the answer", () => {
    expect(checkDetection.describe(yes)).toBe("Is the white king in check?");
    expect(checkDetection.describe(no)).toBe("Is the black king in check?");
    expect(checkDetection.expectedText(yes)).toBe("Yes — Bb4 gives check");
    expect(checkDetection.expectedText(double)).toBe("Yes — Qg4 and h2 give check");
    expect(checkDetection.expectedText(no)).toBe("No — the king is safe");
  });
});
