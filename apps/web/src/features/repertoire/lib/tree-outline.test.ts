import { describe, expect, test } from "bun:test";

import { describeTreeNode, isForkOpen, isForkPinned, toggleCollapsed } from "./tree-outline";
import type { TreeLine, TreeNode } from "./variation-tree";

const node = (overrides: Partial<TreeNode> = {}): TreeNode => ({
  moveId: "m1",
  san: "e4",
  label: "1. e4",
  side: "you",
  positionId: "p1",
  route: ["m1"],
  ply: 1,
  onPath: false,
  isCurrent: false,
  transposition: false,
  alternatives: [],
  ...overrides,
});

const line = (...nodes: TreeNode[]): TreeLine => ({ depth: 1, isAlternative: true, nodes });

describe("toggleCollapsed", () => {
  test("adds a move that is open and removes one that is collapsed", () => {
    const collapsed = toggleCollapsed(new Set(), "m1");
    expect([...collapsed]).toEqual(["m1"]);
    expect([...toggleCollapsed(collapsed, "m1")]).toEqual([]);
  });

  test("returns a new set and leaves the given one alone", () => {
    const before: ReadonlySet<string> = new Set(["m1"]);
    const after = toggleCollapsed(before, "m2");
    expect(after).not.toBe(before);
    expect([...before]).toEqual(["m1"]);
    expect([...after].sort()).toEqual(["m1", "m2"]);
  });
});

describe("isForkOpen", () => {
  const fork = node({ moveId: "m2", alternatives: [line(node({ moveId: "m3" }))] });

  test("a fork is open unless it was collapsed", () => {
    expect(isForkOpen(new Set(), fork)).toBe(true);
    expect(isForkOpen(new Set(["m2"]), fork)).toBe(false);
  });

  test("a collapse of another move does not close it", () => {
    expect(isForkOpen(new Set(["m9"]), fork)).toBe(true);
  });

  test("stays open while the line being shown runs through one of its alternatives", () => {
    const onPath = node({
      moveId: "m2",
      alternatives: [line(node({ moveId: "m3", onPath: true }))],
    });
    expect(isForkOpen(new Set(["m2"]), onPath)).toBe(true);
  });
});

describe("isForkPinned", () => {
  test("is true only when the shown line runs through an alternative", () => {
    const off = node({ alternatives: [line(node({ moveId: "m3" }))] });
    const on = node({ alternatives: [line(node({ moveId: "m3" })), line(node({ onPath: true }))] });
    expect(isForkPinned(off)).toBe(false);
    expect(isForkPinned(on)).toBe(true);
    expect(isForkPinned(node())).toBe(false);
  });
});

describe("describeTreeNode", () => {
  test("names the move and whose it is", () => {
    expect(describeTreeNode(node())).toBe("1. e4, your move");
    expect(describeTreeNode(node({ label: "1... e5", side: "reply" }))).toBe(
      "1... e5, opponent reply",
    );
  });

  test("says when a move is an alternative to another, so it never reads as the next move", () => {
    expect(describeTreeNode(node({ label: "2. d4" }), { alternativeTo: "2. Nf3" })).toBe(
      "2. d4, your move, alternative to 2. Nf3",
    );
  });

  test("says when the position was already reached elsewhere", () => {
    expect(describeTreeNode(node({ transposition: true }))).toBe(
      "1. e4, your move, transposition to a position shown above",
    );
  });
});
