import { describe, expect, test } from "bun:test";

import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";
import { buildVariationTree, type TreeLine, type TreeNode } from "./variation-tree";

type Spec = [id: string, from: string, to: string, san: string, isUserMove?: boolean];

const graphOf = (specs: Spec[]): RepertoireGraph => ({
  startPositionId: "start",
  moves: specs.map(([id, from, to, san, isUserMove = true]): RepertoireMove => ({
    id,
    fromPositionId: from,
    toPositionId: to,
    san,
    uci: san,
    isUserMove,
  })),
});

const pathOf = (graph: RepertoireGraph, ...ids: string[]): RepertoireMove[] =>
  ids.map((id) => graph.moves.find((move) => move.id === id) as RepertoireMove);

const sans = (line: TreeLine) => line.nodes.map((node) => node.san);
const alt = (node: TreeNode, index = 0) => node.alternatives[index] as TreeLine;

describe("buildVariationTree", () => {
  test("an empty repertoire is an empty main line", () => {
    const tree = buildVariationTree(graphOf([]), []);
    expect(tree).toEqual({ depth: 0, isAlternative: false, nodes: [] });
  });

  test("a chain of only-children is one flat sequence without nesting", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5", false],
      ["m3", "p2", "p3", "Nf3"],
    ]);
    const tree = buildVariationTree(graph, []);
    expect(sans(tree)).toEqual(["e4", "e5", "Nf3"]);
    expect(tree.nodes.every((node) => node.alternatives.length === 0)).toBe(true);
  });

  test("carries the label, side, position, route and ply of each move", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5", false],
      ["m3", "p2", "p3", "Nf3"],
    ]);
    const [e4, e5, nf3] = buildVariationTree(graph, []).nodes as [TreeNode, TreeNode, TreeNode];
    expect(e4).toMatchObject({
      moveId: "m1",
      label: "1. e4",
      side: "you",
      positionId: "p1",
      ply: 1,
    });
    expect(e4.route).toEqual(["m1"]);
    expect(e5).toMatchObject({ label: "1... e5", side: "reply", ply: 2 });
    expect(nf3).toMatchObject({ label: "2. Nf3", route: ["m1", "m2", "m3"], ply: 3 });
  });

  test("a fork at the root: the first child continues, the others are alternatives", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "start", "p2", "d4"],
      ["m3", "start", "p3", "c4"],
      ["m4", "p1", "p4", "e5", false],
    ]);
    const tree = buildVariationTree(graph, []);
    expect(sans(tree)).toEqual(["e4", "e5"]);
    const [first] = tree.nodes as [TreeNode];
    expect(first.alternatives).toHaveLength(2);
    expect(first.alternatives.map(sans)).toEqual([["d4"], ["c4"]]);
    expect(first.alternatives.every((line) => line.isAlternative)).toBe(true);
    expect(first.alternatives.map((line) => line.depth)).toEqual([1, 1]);
    expect(alt(first).nodes[0]?.route).toEqual(["m2"]);
  });

  test("a fork deep in a chain hangs its alternatives on the continuing move", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5", false],
      ["m3", "p2", "p3", "Nf3"],
      ["m4", "p2", "p4", "Bc4"],
      ["m5", "p3", "p5", "Nc6", false],
    ]);
    const tree = buildVariationTree(graph, []);
    expect(sans(tree)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(tree.nodes.slice(0, 2).every((node) => node.alternatives.length === 0)).toBe(true);
    const nf3 = tree.nodes[2] as TreeNode;
    expect(sans(alt(nf3))).toEqual(["Bc4"]);
    expect(alt(nf3).nodes[0]?.route).toEqual(["m1", "m2", "m4"]);
  });

  test("nested forks nest one level deeper each time", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "start", "p2", "d4"],
      ["m3", "p2", "p3", "d5", false],
      ["m4", "p2", "p4", "Nf6", false],
      ["m5", "p4", "p5", "c4"],
      ["m6", "p4", "p6", "Nf3"],
    ]);
    const tree = buildVariationTree(graph, []);
    const d4Line = alt(tree.nodes[0] as TreeNode);
    expect(sans(d4Line)).toEqual(["d4", "d5"]);
    const d5 = d4Line.nodes[1] as TreeNode;
    expect(d5.alternatives.map(sans)).toEqual([["Nf6", "c4"]]);
    const nf6Line = alt(d5);
    expect(nf6Line.depth).toBe(2);
    expect(alt(nf6Line.nodes[1] as TreeNode).depth).toBe(3);
    expect(sans(alt(nf6Line.nodes[1] as TreeNode))).toEqual(["Nf3"]);
  });

  test("expands a transposed position once and marks the later arrival", () => {
    // start -e4-> p1 -e5-> p2 -Nf3-> p3 ; start -Nf3-> p4 -e5-> p5 -e4-> p3 -Nc6-> p6
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5", false],
      ["m3", "p2", "p3", "Nf3"],
      ["m4", "start", "p4", "Nf3"],
      ["m5", "p4", "p5", "e5", false],
      ["m6", "p5", "p3", "e4"],
      ["m7", "p3", "p6", "Nc6", false],
    ]);
    const tree = buildVariationTree(graph, []);
    expect(sans(tree)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    const nf3Line = alt(tree.nodes[0] as TreeNode);
    expect(sans(nf3Line)).toEqual(["Nf3", "e5", "e4"]);
    const [, , late] = nf3Line.nodes as [TreeNode, TreeNode, TreeNode];
    expect(late.transposition).toBe(true);
    expect(late.positionId).toBe("p3");
    expect(tree.nodes.some((node) => node.transposition)).toBe(false);
  });

  test("does not loop on a cycle in the graph", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "Nf3"],
      ["m2", "p1", "p2", "Nf6", false],
      ["m3", "p2", "p3", "Ng1"],
      ["m4", "p3", "start", "Ng8", false],
    ]);
    const tree = buildVariationTree(graph, []);
    expect(sans(tree)).toEqual(["Nf3", "Nf6", "Ng1", "Ng8"]);
    expect(tree.nodes.at(-1)?.transposition).toBe(true);
  });

  test("marks the current path, including through an alternative", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "p1", "p2", "e5", false],
      ["m3", "p1", "p3", "c5", false],
      ["m4", "p3", "p4", "Nf3"],
    ]);
    const tree = buildVariationTree(graph, pathOf(graph, "m1", "m3", "m4"));
    const [e4, e5] = tree.nodes as [TreeNode, TreeNode];
    expect(e4).toMatchObject({ onPath: true, isCurrent: false });
    expect(e5).toMatchObject({ onPath: false, isCurrent: false });
    const c5Line = alt(e5);
    expect(c5Line.nodes.map((node) => node.onPath)).toEqual([true, true]);
    expect(c5Line.nodes.map((node) => node.isCurrent)).toEqual([false, true]);
  });

  test("marks nothing as current at the start position", () => {
    const graph = graphOf([["m1", "start", "p1", "e4"]]);
    const [e4] = buildVariationTree(graph, []).nodes as [TreeNode];
    expect(e4).toMatchObject({ onPath: false, isCurrent: false });
  });

  test("depends only on the graph and the path: equal inputs give equal trees", () => {
    const graph = graphOf([
      ["m1", "start", "p1", "e4"],
      ["m2", "start", "p2", "d4"],
    ]);
    expect(buildVariationTree(graph, pathOf(graph, "m1"))).toEqual(
      buildVariationTree(graph, pathOf(graph, "m1")),
    );
  });
});
