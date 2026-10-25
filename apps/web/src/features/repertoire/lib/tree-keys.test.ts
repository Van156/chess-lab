import { describe, expect, test } from "bun:test";

import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";
import { treeKeyTarget, type TreeKeyContext, type TreeKeyEvent } from "./tree-keys";

type Spec = [id: string, from: string, to: string, san: string];

const graphOf = (specs: Spec[]): RepertoireGraph => ({
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
});

/** 1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6, and 1. d4. The first stored move is the main line. */
const graph = graphOf([
  ["m1", "start", "p1", "e4"],
  ["m2", "p1", "p2", "e5"],
  ["m3", "p2", "p3", "Nf3"],
  ["m4", "p3", "p4", "Nc6"],
  ["m5", "p1", "p5", "c5"],
  ["m6", "p5", "p6", "Nf3"],
  ["m7", "start", "p7", "d4"],
]);

const byId = (...ids: string[]): RepertoireMove[] =>
  ids.map((id) => graph.moves.find((move) => move.id === id) as RepertoireMove);

const context = (path: string[], baseLine: string[] = []): TreeKeyContext => ({
  graph,
  path: byId(...path),
  baseLine: byId(...baseLine),
});

const press = (key: string, overrides: Partial<TreeKeyEvent> = {}): TreeKeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetUsesArrows: false,
  ...overrides,
});

describe("treeKeyTarget", () => {
  test("ArrowLeft goes to the parent, along the route taken", () => {
    expect(treeKeyTarget(press("ArrowLeft"), context(["m1", "m2", "m3"]))).toEqual({
      positionId: "p2",
      route: ["m1", "m2"],
    });
    expect(treeKeyTarget(press("ArrowLeft"), context(["m1"]))).toEqual({
      positionId: "start",
      route: [],
    });
  });

  test("ArrowLeft does nothing at the start", () => {
    expect(treeKeyTarget(press("ArrowLeft"), context([]))).toBeNull();
  });

  test("ArrowRight goes to the first stored child", () => {
    expect(treeKeyTarget(press("ArrowRight"), context(["m1"]))).toEqual({
      positionId: "p2",
      route: ["m1", "m2"],
    });
    expect(treeKeyTarget(press("ArrowRight"), context([]))).toEqual({
      positionId: "p1",
      route: ["m1"],
    });
  });

  test("ArrowRight prefers the child on the base line over the first stored one", () => {
    expect(treeKeyTarget(press("ArrowRight"), context([], ["m7"]))).toEqual({
      positionId: "p7",
      route: ["m7"],
    });
    expect(treeKeyTarget(press("ArrowRight"), context(["m1"], ["m1", "m5", "m6"]))).toEqual({
      positionId: "p5",
      route: ["m1", "m5"],
    });
  });

  test("ArrowRight does nothing at a leaf", () => {
    expect(treeKeyTarget(press("ArrowRight"), context(["m1", "m2", "m3", "m4"]))).toBeNull();
  });

  test("Home goes to the start position, and does nothing there", () => {
    expect(treeKeyTarget(press("Home"), context(["m1", "m5"]))).toEqual({
      positionId: "start",
      route: [],
    });
    expect(treeKeyTarget(press("Home"), context([]))).toBeNull();
  });

  test("End follows the preferred child down to the leaf", () => {
    expect(treeKeyTarget(press("End"), context(["m1"]))).toEqual({
      positionId: "p4",
      route: ["m1", "m2", "m3", "m4"],
    });
    expect(treeKeyTarget(press("End"), context(["m1"], ["m1", "m5"]))).toEqual({
      positionId: "p6",
      route: ["m1", "m5", "m6"],
    });
  });

  test("End does nothing at a leaf", () => {
    expect(treeKeyTarget(press("End"), context(["m7"]))).toBeNull();
  });

  test("End stops if the graph loops back on itself", () => {
    const loop = graphOf([
      ["a", "start", "p1", "Nf3"],
      ["b", "p1", "start", "Ng1"],
    ]);
    const target = treeKeyTarget(press("End"), { graph: loop, path: [], baseLine: [] });
    expect(target).toEqual({ positionId: "p1", route: ["a"] });
  });

  test("ignores a key with ctrl, meta or alt held", () => {
    for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
      expect(treeKeyTarget(press("ArrowLeft", { [modifier]: true }), context(["m1"]))).toBeNull();
      expect(treeKeyTarget(press("ArrowRight", { [modifier]: true }), context([]))).toBeNull();
    }
  });

  test("ignores a key from a control that reads the arrows itself", () => {
    expect(
      treeKeyTarget(press("ArrowLeft", { targetUsesArrows: true }), context(["m1"])),
    ).toBeNull();
    expect(treeKeyTarget(press("Home", { targetUsesArrows: true }), context(["m1"]))).toBeNull();
  });

  test("ignores any other key", () => {
    expect(treeKeyTarget(press("a"), context(["m1"]))).toBeNull();
    expect(treeKeyTarget(press("ArrowUp"), context(["m1"]))).toBeNull();
    expect(treeKeyTarget(press("Escape"), context(["m1"]))).toBeNull();
  });
});
