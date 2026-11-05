import { describe, expect, test } from "bun:test";

import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";
import { lineNameEdit, studyLines } from "./study-lines";
import { buildVariationTree } from "./variation-tree";

type Spec = [id: string, from: string, to: string, san: string, name?: string | null];

const graphOf = (specs: Spec[]): RepertoireGraph => ({
  startPositionId: "start",
  moves: specs.map(([id, from, to, san, name = null]): RepertoireMove => ({
    id,
    fromPositionId: from,
    toPositionId: to,
    san,
    uci: san,
    name,
    isUserMove: true,
  })),
});

const pathOf = (graph: RepertoireGraph, ...ids: string[]) =>
  ids.map((id) => graph.moves.find((move) => move.id === id) as RepertoireMove);

/** 1. e4 e5 2. Nf3 Nc6 3. d4 exd4, then three ways on: 4. c3, 4. Nxd4 and 4. Bc4. */
const scotch = graphOf([
  ["m1", "start", "p1", "e4"],
  ["m2", "p1", "p2", "e5"],
  ["m3", "p2", "p3", "Nf3"],
  ["m4", "p3", "p4", "Nc6"],
  ["m5", "p4", "p5", "d4"],
  ["m6", "p5", "p6", "exd4"],
  ["m7", "p6", "p7", "c3", "Danish"],
  ["m8", "p6", "p8", "Nxd4"],
  ["m9", "p6", "p9", "Bc4"],
  ["m10", "p7", "p10", "dxc3"],
]);
const base = pathOf(scotch, "m1", "m2", "m3", "m4", "m5", "m6");

describe("studyLines", () => {
  test("has none for a repertoire without moves", () => {
    expect(studyLines(buildVariationTree(graphOf([]), []))).toEqual([]);
  });

  test("makes one group of a single move, and it can carry a name", () => {
    const graph = graphOf([["m1", "start", "p1", "e4", "King's pawn"]]);
    const lines = studyLines(buildVariationTree(graph, []));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.firstMove.label).toBe("1. e4");
    expect(lines[0]?.name).toBe("King's pawn");
    expect(lines[0]?.line.nodes.map((node) => node.san)).toEqual(["e4"]);
  });

  test("starts one group for each move leaving the base, in stored order", () => {
    const lines = studyLines(buildVariationTree(scotch, [], base));
    expect(lines.map((line) => line.firstMove.label)).toEqual(["4. c3", "4. Nxd4", "4. Bc4"]);
  });

  test("keeps a group's continuation, and its first move no longer lists the other groups", () => {
    const [first, second] = studyLines(buildVariationTree(scotch, [], base));
    expect(first?.line.nodes.map((node) => node.san)).toEqual(["c3", "dxc3"]);
    expect(first?.line.nodes[0]?.alternatives).toEqual([]);
    expect(second?.line.nodes.map((node) => node.san)).toEqual(["Nxd4"]);
  });

  test("carries the name of the first move, null when it has none", () => {
    const lines = studyLines(buildVariationTree(scotch, [], base));
    expect(lines.map((line) => line.name)).toEqual(["Danish", null, null]);
  });

  test("marks only the group that holds the line being shown", () => {
    const path = pathOf(scotch, "m1", "m2", "m3", "m4", "m5", "m6", "m9");
    const lines = studyLines(buildVariationTree(scotch, path, base));
    expect(lines.map((line) => line.isCurrent)).toEqual([false, false, true]);
  });

  test("marks the first group when the line runs through it", () => {
    const path = pathOf(scotch, "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m10");
    const lines = studyLines(buildVariationTree(scotch, path, base));
    expect(lines.map((line) => line.isCurrent)).toEqual([true, false, false]);
  });

  test("marks no group while the board is at the base", () => {
    const lines = studyLines(buildVariationTree(scotch, base, base));
    expect(lines.some((line) => line.isCurrent)).toBe(false);
  });

  test("without a base the groups are the moves from the start position", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "start", "p3", "d4"],
    ]);
    const lines = studyLines(buildVariationTree(graph, []));
    expect(lines.map((line) => line.firstMove.label)).toEqual(["1. e4", "1. d4"]);
    expect(lines[0]?.line.nodes.map((node) => node.san)).toEqual(["e4", "e5"]);
  });

  test("keeps forks deeper in a group as alternatives", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5"],
      ["m3", "p1", "p3", "c5"],
    ]);
    const [only] = studyLines(buildVariationTree(graph, []));
    expect(only?.line.nodes[1]?.alternatives).toHaveLength(1);
  });

  test("does not change the tree it reads", () => {
    const tree = buildVariationTree(scotch, [], base);
    studyLines(tree);
    expect(tree.nodes[0]?.alternatives).toHaveLength(2);
  });
});

describe("lineNameEdit", () => {
  test("saves a changed name, trimmed", () => {
    expect(lineNameEdit("  Danish  ", null)).toEqual({ save: true, name: "Danish" });
    expect(lineNameEdit("Danish", "Old")).toEqual({ save: true, name: "Danish" });
  });

  test("clears the name when the text is blank", () => {
    expect(lineNameEdit("   ", "Danish")).toEqual({ save: true, name: null });
  });

  test("saves nothing when the name does not change", () => {
    expect(lineNameEdit(" Danish ", "Danish")).toEqual({ save: false });
    expect(lineNameEdit("", null)).toEqual({ save: false });
  });
});
