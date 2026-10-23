import { describe, expect, test } from "bun:test";

import { childMoves, formatLine, pathTo, removalPreview } from "./repertoire-tree";
import type { RepertoireData, RepertoirePosition } from "./repertoire-types";

/**
 * start -e4-> p1 -e5-> p2 -Nf3-> p3 ; start -Nf3-> p4 -e5-> p5 -e4-> p3 (transposition) ;
 * start -d4-> p6 -d5-> p7
 */
function tree(): RepertoireData {
  const position = (id: string): RepertoirePosition => ({
    id,
    key: `key-${id}` as RepertoirePosition["key"],
    fen: `fen-${id}`,
    sideToMove: "w",
  });
  const move = (id: string, from: string, to: string, san: string) => ({
    id,
    fromPositionId: from,
    toPositionId: to,
    san,
    uci: san,
    isUserMove: true,
  });
  return {
    repertoire: {
      id: "r1",
      color: "white",
      name: "Open games",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    startPositionId: "start",
    positions: ["start", "p1", "p2", "p3", "p4", "p5", "p6", "p7"].map(position),
    moves: [
      move("m1", "start", "p1", "e4"),
      move("m2", "p1", "p2", "e5"),
      move("m3", "p2", "p3", "Nf3"),
      move("m4", "start", "p4", "Nf3"),
      move("m5", "p4", "p5", "e5"),
      move("m6", "p5", "p3", "e4"),
      move("m7", "start", "p6", "d4"),
      move("m8", "p6", "p7", "d5"),
    ],
    notes: {},
  };
}

describe("childMoves", () => {
  test("lists the moves out of a position in stored order", () => {
    expect(childMoves(tree(), "start").map((move) => move.san)).toEqual(["e4", "Nf3", "d4"]);
  });

  test("a leaf has no children and an unknown id yields none", () => {
    expect(childMoves(tree(), "p3")).toEqual([]);
    expect(childMoves(tree(), "nope")).toEqual([]);
  });
});

describe("pathTo", () => {
  test("is empty for the start position", () => {
    expect(pathTo(tree(), "start")).toEqual([]);
  });

  test("follows the first-found shortest route when none is supplied", () => {
    expect(pathTo(tree(), "p3")?.map((move) => move.san)).toEqual(["e4", "e5", "Nf3"]);
  });

  test("prefers a supplied route that reaches the position (transposition)", () => {
    expect(pathTo(tree(), "p3", ["m4", "m5", "m6"])?.map((move) => move.san)).toEqual([
      "Nf3",
      "e5",
      "e4",
    ]);
  });

  test("ignores a supplied route that is broken or ends elsewhere", () => {
    expect(pathTo(tree(), "p3", ["m4", "m5"])?.map((move) => move.id)).toEqual(["m1", "m2", "m3"]);
    expect(pathTo(tree(), "p3", ["m2"])?.map((move) => move.id)).toEqual(["m1", "m2", "m3"]);
  });

  test("is null for an unknown position", () => {
    expect(pathTo(tree(), "nope")).toBeNull();
  });
});

describe("formatLine", () => {
  test("numbers white moves and keeps black replies on the same number", () => {
    const path = pathTo(tree(), "p3") ?? [];
    expect(formatLine(path)).toBe("1. e4 e5 2. Nf3");
  });

  test("says Start position for an empty line", () => {
    expect(formatLine([])).toBe("Start position");
  });
});

describe("removalPreview", () => {
  test("removing a branch removes its whole subtree", () => {
    const preview = removalPreview(tree(), "m7");
    expect(preview.moveIds.toSorted()).toEqual(["m7", "m8"]);
    expect(preview.positionIds.toSorted()).toEqual(["p6", "p7"]);
  });

  test("keeps positions still reachable through another move order", () => {
    const preview = removalPreview(tree(), "m1");
    expect(preview.moveIds.toSorted()).toEqual(["m1", "m2", "m3"]);
    expect(preview.positionIds.toSorted()).toEqual(["p1", "p2"]);
  });

  test("a leaf move removes only itself and its position", () => {
    expect(removalPreview(tree(), "m8")).toEqual({ moveIds: ["m8"], positionIds: ["p7"] });
  });

  test("a move whose target stays reachable removes only the edge", () => {
    expect(removalPreview(tree(), "m6")).toEqual({ moveIds: ["m6"], positionIds: [] });
  });

  test("an unknown move removes nothing", () => {
    expect(removalPreview(tree(), "nope")).toEqual({ moveIds: [], positionIds: [] });
  });
});
