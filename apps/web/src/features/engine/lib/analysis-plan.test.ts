import { describe, expect, test } from "bun:test";
import type { PlyEval } from "@b2c-template/chess";

import { CONFIRM_DEPTH } from "../config";
import {
  append,
  canAppend,
  confirmIndices,
  emptyBatch,
  isFull,
  positionFens,
  screenIndices,
  toPlyEval,
} from "./analysis-plan";
import { SCHOLAR } from "./test-games";

describe("positionFens", () => {
  test("returns one position per ply plus the starting position", () => {
    const fens = positionFens(SCHOLAR);
    expect(fens).toHaveLength(8);
    expect(fens[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(fens[7]).toContain("Q"); // queen on f7
  });

  test("an unreadable PGN throws", () => {
    expect(() => positionFens("1. e9 zz")).toThrow();
  });
});

describe("toPlyEval", () => {
  test("maps a centipawn score, depth and best move", () => {
    expect(
      toPlyEval({
        bestMove: "e2e4",
        score: { kind: "cp", value: 31 },
        depth: 10,
        pv: [],
        lines: [],
      }),
    ).toEqual({ cp: 31, depth: 10, bestUci: "e2e4" });
  });

  test("maps a mate score and omits a missing best move", () => {
    expect(
      toPlyEval({
        bestMove: null,
        score: { kind: "mate", value: -2 },
        depth: 18,
        pv: [],
        lines: [],
      }),
    ).toEqual({ mate: -2, depth: 18 });
  });

  test("a position without a score has no evaluation", () => {
    expect(toPlyEval({ bestMove: null, score: null, depth: 0, pv: [], lines: [] })).toBeNull();
  });
});

describe("screenIndices", () => {
  test("starts at the resume point and covers the last position", () => {
    expect(screenIndices(0, 3)).toEqual([0, 1, 2]);
    expect(screenIndices(5, 8)).toEqual([5, 6, 7]);
  });

  test("is empty once every position is screened", () => {
    expect(screenIndices(8, 8)).toEqual([]);
    expect(screenIndices(9, 8)).toEqual([]);
  });
});

describe("confirmIndices", () => {
  const quiet = (depth = 10): PlyEval => ({ cp: 0, depth });
  /** White's move at ply 3 loses a lot: before +30 for white, after +400 for black. */
  const blunderAtPly3 = (depth = 10): PlyEval[] => [
    quiet(depth),
    quiet(depth),
    { cp: 30, depth },
    { cp: 400, depth },
    quiet(depth),
    quiet(depth),
    quiet(depth),
    quiet(depth),
  ];

  test("selects the positions before and after each of the user's costly moves", () => {
    expect(confirmIndices(SCHOLAR, blunderAtPly3(), "white")).toEqual([2, 3]);
  });

  test("judges only the user's own colour", () => {
    // Black's ply 4 (positions 3 -> 4) loses 420 on these evals; white's ply 3 is not black's.
    expect(confirmIndices(SCHOLAR, blunderAtPly3(), "black")).toEqual([3, 4]);
  });

  test("skips positions that already hold a confirm-depth evaluation", () => {
    const evals = blunderAtPly3();
    evals[2] = { cp: 30, depth: CONFIRM_DEPTH };
    expect(confirmIndices(SCHOLAR, evals, "white")).toEqual([3]);
  });

  test("a game without costly moves has nothing to confirm", () => {
    expect(confirmIndices(SCHOLAR, Array(8).fill(quiet()), "white")).toEqual([]);
  });
});

describe("batch", () => {
  test("an empty batch accepts any index; later ones must be contiguous", () => {
    let batch = emptyBatch("screen");
    expect(canAppend(batch, 4, "screen")).toBe(true);
    batch = append(batch, 4, null);
    expect(batch.fromPly).toBe(4);
    expect(canAppend(batch, 5, "screen")).toBe(true);
    expect(canAppend(batch, 7, "screen")).toBe(false);
  });

  test("a different phase does not continue the batch", () => {
    const batch = append(emptyBatch("screen"), 0, null);
    expect(canAppend(batch, 1, "confirm")).toBe(false);
  });

  test("is full at the submit size", () => {
    let batch = emptyBatch("screen");
    for (let i = 0; i < 3; i++) batch = append(batch, i, null);
    expect(isFull(batch, 3)).toBe(true);
    expect(isFull(batch, 4)).toBe(false);
  });
});
