import { describe, expect, test } from "bun:test";

import type { EngineLine } from "@/features/engine";

import {
  bestMoveArrow,
  describeScore,
  formatScore,
  pvToSan,
  toSuggestionLines,
  toWhiteScore,
  winPercent,
  type WhiteScore,
} from "./engine-view";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK_TO_MOVE = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const MIDDLE = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const BLACK_MID = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 12";
const PROMOTION = "8/4P3/8/8/8/8/k6K/8 w - - 0 1";

const cp = (value: number): WhiteScore => ({ kind: "cp", cp: value });

describe("toWhiteScore", () => {
  test("keeps a centipawn score when White is to move", () => {
    expect(toWhiteScore({ kind: "cp", value: 34 }, START)).toEqual(cp(34));
  });

  test("flips a centipawn score when Black is to move", () => {
    expect(toWhiteScore({ kind: "cp", value: 34 }, BLACK_TO_MOVE)).toEqual(cp(-34));
    expect(toWhiteScore({ kind: "cp", value: -120 }, BLACK_TO_MOVE)).toEqual(cp(120));
  });

  test("a positive mate belongs to the side to move", () => {
    expect(toWhiteScore({ kind: "mate", value: 3 }, START)).toEqual({
      kind: "mate",
      moves: 3,
      winner: "white",
    });
    expect(toWhiteScore({ kind: "mate", value: 3 }, BLACK_TO_MOVE)).toEqual({
      kind: "mate",
      moves: 3,
      winner: "black",
    });
  });

  test("a negative mate belongs to the other side", () => {
    expect(toWhiteScore({ kind: "mate", value: -2 }, START)).toEqual({
      kind: "mate",
      moves: 2,
      winner: "black",
    });
    expect(toWhiteScore({ kind: "mate", value: -2 }, BLACK_TO_MOVE)).toEqual({
      kind: "mate",
      moves: 2,
      winner: "white",
    });
  });

  test("mate 0 means the side to move is already mated", () => {
    expect(toWhiteScore({ kind: "mate", value: 0 }, START)).toEqual({
      kind: "mate",
      moves: 0,
      winner: "black",
    });
    expect(toWhiteScore({ kind: "mate", value: 0 }, BLACK_TO_MOVE)).toEqual({
      kind: "mate",
      moves: 0,
      winner: "white",
    });
  });
});

describe("formatScore", () => {
  test("zero has no sign", () => {
    expect(formatScore(cp(0))).toBe("0.00");
  });

  test("positive and negative scores are signed with two decimals", () => {
    expect(formatScore(cp(34))).toBe("+0.34");
    expect(formatScore(cp(-120))).toBe("-1.20");
    expect(formatScore(cp(1050))).toBe("+10.50");
  });

  test("rounds to the nearest hundredth of a pawn", () => {
    expect(formatScore(cp(5))).toBe("+0.05");
    expect(formatScore(cp(-7))).toBe("-0.07");
  });

  test("a mate shows the number of moves, negative for Black", () => {
    expect(formatScore({ kind: "mate", moves: 3, winner: "white" })).toBe("#3");
    expect(formatScore({ kind: "mate", moves: 2, winner: "black" })).toBe("#-2");
  });

  test("a mate in 0 has no sign", () => {
    expect(formatScore({ kind: "mate", moves: 0, winner: "black" })).toBe("#0");
    expect(formatScore({ kind: "mate", moves: 0, winner: "white" })).toBe("#0");
  });
});

describe("describeScore", () => {
  test("names the better side and the margin in pawns", () => {
    expect(describeScore(cp(34))).toBe("White is better by 0.34 pawns");
    expect(describeScore(cp(-120))).toBe("Black is better by 1.20 pawns");
  });

  test("a zero score is an even position", () => {
    expect(describeScore(cp(0))).toBe("Even position");
  });

  test("a mate names the winner and the distance", () => {
    expect(describeScore({ kind: "mate", moves: 3, winner: "white" })).toBe("White mates in 3");
    expect(describeScore({ kind: "mate", moves: 2, winner: "black" })).toBe("Black mates in 2");
    expect(describeScore({ kind: "mate", moves: 1, winner: "white" })).toBe("White mates in 1");
  });

  test("mate in 0 is a checkmate", () => {
    expect(describeScore({ kind: "mate", moves: 0, winner: "white" })).toBe("Checkmate");
  });
});

describe("winPercent", () => {
  test("an even score is 50", () => {
    expect(winPercent(cp(0))).toBe(50);
  });

  test("opposite scores add up to 100", () => {
    for (const value of [10, 120, 400, 900]) {
      expect(winPercent(cp(value)) + winPercent(cp(-value))).toBeCloseTo(100, 10);
    }
  });

  test("follows the Lichess curve", () => {
    expect(winPercent(cp(100))).toBeCloseTo(59.1, 1);
    expect(winPercent(cp(-100))).toBeCloseTo(40.9, 1);
  });

  test("clamps the score at 1000 centipawns", () => {
    expect(winPercent(cp(5000))).toBe(winPercent(cp(1000)));
    expect(winPercent(cp(-5000))).toBe(winPercent(cp(-1000)));
    expect(winPercent(cp(1000))).toBeLessThan(100);
  });

  test("a mate is a full win for the winner", () => {
    expect(winPercent({ kind: "mate", moves: 3, winner: "white" })).toBe(100);
    expect(winPercent({ kind: "mate", moves: 3, winner: "black" })).toBe(0);
  });
});

describe("pvToSan", () => {
  test("numbers the moves from White", () => {
    const result = pvToSan(MIDDLE, ["f1b5", "g8f6", "e1g1"], 8);
    expect(result.sans).toEqual(["Bb5", "Nf6", "O-O"]);
    expect(result.text).toBe("3. Bb5 Nf6 4. O-O");
  });

  test("starts with an ellipsis when Black is to move", () => {
    const result = pvToSan(BLACK_MID, ["g8f6", "b1c3", "f8b4"], 8);
    expect(result.sans).toEqual(["Nf6", "Nc3", "Bb4"]);
    expect(result.text).toBe("12... Nf6 13. Nc3 Bb4");
  });

  test("uses the fullmove number of the FEN", () => {
    expect(pvToSan(START, ["e2e4", "e7e5"], 8).text).toBe("1. e4 e5");
  });

  test("stops at the plies limit", () => {
    const result = pvToSan(START, ["e2e4", "e7e5", "g1f3", "b8c6"], 3);
    expect(result.sans).toEqual(["e4", "e5", "Nf3"]);
    expect(result.text).toBe("1. e4 e5 2. Nf3");
  });

  test("stops at the first illegal move", () => {
    const result = pvToSan(START, ["e2e4", "e7e5", "e2e4", "g1f3"], 8);
    expect(result.sans).toEqual(["e4", "e5"]);
    expect(result.text).toBe("1. e4 e5");
  });

  test("an empty or fully illegal line is empty", () => {
    expect(pvToSan(START, [], 8)).toEqual({ sans: [], text: "" });
    expect(pvToSan(START, ["e2e5"], 8)).toEqual({ sans: [], text: "" });
  });
});

describe("bestMoveArrow", () => {
  test("uses the squares of the first move", () => {
    expect(bestMoveArrow(["e2e4", "e7e5"])).toEqual({ from: "e2", to: "e4" });
  });

  test("a promotion arrow ignores the piece letter", () => {
    expect(bestMoveArrow(["e7e8q"])).toEqual({ from: "e7", to: "e8" });
  });

  test("is null for an empty or malformed line", () => {
    expect(bestMoveArrow([])).toBeNull();
    expect(bestMoveArrow(["e2"])).toBeNull();
    expect(bestMoveArrow(["(none)"])).toBeNull();
  });
});

const line = (multipv: number, pv: string[], value = 30, depth = 12): EngineLine => ({
  multipv,
  depth,
  score: { kind: "cp", value },
  pv,
});

describe("toSuggestionLines", () => {
  test("builds the view of each line in order", () => {
    const result = toSuggestionLines(
      START,
      [line(1, ["e2e4", "e7e5"], 34), line(2, ["d2d4", "d7d5"], 20, 11)],
      [],
      8,
    );
    expect(result).toEqual([
      {
        multipv: 1,
        depth: 12,
        white: cp(34),
        scoreText: "+0.34",
        scoreLabel: "White is better by 0.34 pawns",
        firstMove: { san: "e4", uci: "e2e4" },
        pv: ["e2e4", "e7e5"],
        moveText: "1. e4 e5",
        inRepertoire: false,
      },
      {
        multipv: 2,
        depth: 11,
        white: cp(20),
        scoreText: "+0.20",
        scoreLabel: "White is better by 0.20 pawns",
        firstMove: { san: "d4", uci: "d2d4" },
        pv: ["d2d4", "d7d5"],
        moveText: "1. d4 d5",
        inRepertoire: false,
      },
    ]);
  });

  test("scores are shown from White's side", () => {
    const [first] = toSuggestionLines(BLACK_TO_MOVE, [line(1, ["e7e5"], 40)], [], 8);
    expect(first?.scoreText).toBe("-0.40");
    expect(first?.moveText).toBe("1... e5");
  });

  test("marks a first move the repertoire already has", () => {
    const result = toSuggestionLines(
      START,
      [line(1, ["e2e4"]), line(2, ["d2d4"])],
      [{ san: "e4" }],
      8,
    );
    expect(result.map((entry) => entry.inRepertoire)).toEqual([true, false]);
  });

  test("drops a line whose first move is illegal and keeps the order", () => {
    const result = toSuggestionLines(
      START,
      [line(1, ["e2e4"]), line(2, ["e2e5"]), line(3, ["g1f3"])],
      [],
      8,
    );
    expect(result.map((entry) => entry.multipv)).toEqual([1, 3]);
  });

  test("a promotion line carries the promoted SAN", () => {
    const [first] = toSuggestionLines(PROMOTION, [line(1, ["e7e8q"], 900)], [], 8);
    expect(first?.firstMove).toEqual({ san: "e8=Q", uci: "e7e8q" });
  });
});
