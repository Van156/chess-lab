import { describe, expect, test } from "bun:test";

import { toMoveRows, type MoveRow } from "./move-rows";
import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";
import { buildVariationTree, type TreeLine, type TreeNode } from "./variation-tree";

type Spec = [id: string, from: string, to: string, san: string];

const treeOf = (specs: Spec[]): TreeLine => {
  const graph: RepertoireGraph = {
    startPositionId: "start",
    moves: specs.map(([id, from, to, san]): RepertoireMove => ({
      id,
      fromPositionId: from,
      toPositionId: to,
      san,
      uci: san,
      name: null,
      isUserMove: true,
    })),
  };
  return buildVariationTree(graph, []);
};

/** "1. e4 e5", "1... e5" or "1. d4": the row as it reads in chess notation. */
const read = (row: MoveRow) =>
  [`${row.moveNumber}${row.white ? "." : "..."}`, row.white?.san, row.black?.san]
    .filter(Boolean)
    .join(" ");

const readAll = (line: TreeLine) => toMoveRows(line).map(read);

describe("toMoveRows", () => {
  test("an empty line has no rows", () => {
    expect(toMoveRows({ depth: 0, isAlternative: false, nodes: [] })).toEqual([]);
  });

  test("pairs White and Black into one row per full move", () => {
    const tree = treeOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "p2", "p3", "Nf3"],
      ["m4", "p3", "p4", "Nc6"],
      ["m5", "p4", "p5", "Bc4"],
    ]);
    expect(readAll(tree)).toEqual(["1. e4 e5", "2. Nf3 Nc6", "3. Bc4"]);
    expect(toMoveRows(tree).every((row) => row.fork === undefined)).toBe(true);
  });

  test("a White fork ends its row; Black continues on a row of its own", () => {
    const tree = treeOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "start", "p3", "d4"],
      ["m4", "p3", "p4", "d5"],
    ]);
    const rows = toMoveRows(tree);
    expect(rows.map(read)).toEqual(["1. e4", "1... e5"]);
    expect(rows[0]?.fork?.san).toBe("e4");
    expect(rows[0]?.fork?.alternatives).toHaveLength(1);
    expect(rows[1]?.fork).toBeUndefined();
    // The alternative is a line of its own and pairs normally.
    expect(readAll(rows[0]?.fork?.alternatives[0] as TreeLine)).toEqual(["1. d4 d5"]);
  });

  test("a Black fork ends its row after Black's move; the next row continues normally", () => {
    const tree = treeOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "p2", "p3", "Nf3"],
      ["m4", "p1", "p4", "c5"],
    ]);
    const rows = toMoveRows(tree);
    expect(rows.map(read)).toEqual(["1. e4 e5", "2. Nf3"]);
    expect(rows[0]?.fork?.san).toBe("e5");
    expect(rows[1]?.fork).toBeUndefined();
  });

  test("an alternative that starts with Black reads as `N... black` and then pairs", () => {
    const tree = treeOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "p1", "p3", "c5"],
      ["m4", "p3", "p4", "Nf3"],
      ["m5", "p4", "p5", "d6"],
    ]);
    const alternative = toMoveRows(tree)[0]?.fork?.alternatives[0] as TreeLine;
    const rows = toMoveRows(alternative);
    expect(rows.map(read)).toEqual(["1... c5", "2. Nf3 d6"]);
    expect(rows[0]?.white).toBeUndefined();
    expect(rows[0]?.black?.san).toBe("c5");
  });

  test("a line that starts with Black from the start position begins with a Black-only row", () => {
    const black = (ply: number, san: string): TreeNode => ({
      moveId: `m${ply}`,
      san,
      name: null,
      label: `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${san}`,
      side: "reply",
      positionId: `p${ply}`,
      route: [],
      ply,
      onPath: false,
      isCurrent: false,
      transposition: false,
      alternatives: [],
    });
    const line: TreeLine = {
      depth: 0,
      isAlternative: false,
      nodes: [black(2, "e5"), black(3, "Nf3"), black(4, "Nc6")],
    };
    expect(readAll(line)).toEqual(["1... e5", "2. Nf3 Nc6"]);
  });

  test("a transposition leaf is the last half-move of its row", () => {
    const tree = treeOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "start", "p3", "d4"],
      ["m4", "p3", "p2", "e5"],
    ]);
    const alternative = toMoveRows(tree)[0]?.fork?.alternatives[0] as TreeLine;
    const rows = toMoveRows(alternative);
    expect(rows.map(read)).toEqual(["1. d4 e5"]);
    expect(rows[0]?.black?.transposition).toBe(true);
  });
});
