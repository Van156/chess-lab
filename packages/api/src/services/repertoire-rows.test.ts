import { START_FEN, positionKey } from "@b2c-template/chess";
import { describe, expect, test } from "bun:test";

import { reachablePositionIds, rowsToGraph } from "./repertoire-rows";

describe("reachablePositionIds", () => {
  test("follows moves from the start, including transpositions and ignoring orphans", () => {
    const moves = [
      { fromPositionId: "s", toPositionId: "a" },
      { fromPositionId: "s", toPositionId: "b" },
      { fromPositionId: "a", toPositionId: "c" },
      { fromPositionId: "b", toPositionId: "c" },
      { fromPositionId: "x", toPositionId: "y" },
    ];
    expect([...reachablePositionIds("s", moves)].sort()).toEqual(["a", "b", "c", "s"]);
    expect(
      [
        ...reachablePositionIds(
          "s",
          moves.filter((m) => m.toPositionId !== "b"),
        ),
      ].sort(),
    ).toEqual(["a", "c", "s"]);
  });

  test("a lone start reaches only itself", () => {
    expect([...reachablePositionIds("s", [])]).toEqual(["s"]);
  });
});

describe("rowsToGraph", () => {
  test("keys positions and derives isUserMove from the repertoire colour", () => {
    const key = positionKey(START_FEN);
    const afterFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const afterKey = positionKey(afterFen);
    const positions = [
      { id: "p1", positionKey: key, fen: START_FEN, sideToMove: "w" as const },
      { id: "p2", positionKey: afterKey, fen: afterFen, sideToMove: "b" as const },
    ];
    const moves = [{ id: "m1", fromPositionId: "p1", toPositionId: "p2", san: "e4", uci: "e2e4" }];
    const white = rowsToGraph("white", positions, moves);
    expect(white.moves).toEqual([
      { fromKey: key, toKey: afterKey, san: "e4", uci: "e2e4", isUserMove: true },
    ]);
    expect(rowsToGraph("black", positions, moves).moves[0]!.isUserMove).toBe(false);
    expect(Object.keys(white.positions)).toEqual([key, afterKey]);
  });
});
