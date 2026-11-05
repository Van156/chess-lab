import { describe, expect, test } from "bun:test";

import { baseHeading, baseLine, basePly, canSetBase } from "./base-line";
import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

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

/** The Scotch gambit to 3... exd4, then 4. c3. */
const scotch = graphOf([
  ["m1", "start", "p1", "e4"],
  ["m2", "p1", "p2", "e5"],
  ["m3", "p2", "p3", "Nf3"],
  ["m4", "p3", "p4", "Nc6"],
  ["m5", "p4", "p5", "d4"],
  ["m6", "p5", "p6", "exd4"],
  ["m7", "p6", "p7", "c3"],
]);

const sans = (line: RepertoireMove[]) => line.map((move) => move.san);

describe("baseLine", () => {
  test("is empty when no base is set", () => {
    expect(baseLine(scotch, null)).toEqual([]);
  });

  test("is empty for the start position and for a position the graph does not hold", () => {
    expect(baseLine(scotch, "start")).toEqual([]);
    expect(baseLine(scotch, "gone")).toEqual([]);
  });

  test("lists the moves from the start to a base six plies deep", () => {
    expect(sans(baseLine(scotch, "p6"))).toEqual(["e4", "e5", "Nf3", "Nc6", "d4", "exd4"]);
  });

  test("takes the shortest route to a base reached by transposition", () => {
    const graph = graphOf([
      ["a1", "start", "x1", "e4"],
      ["a2", "x1", "x2", "e5"],
      ["a3", "x2", "base", "Nf3"],
      ["b1", "start", "y1", "Nf3"],
      ["b2", "y1", "y2", "e5"],
      ["b3", "y2", "y3", "e4"],
      ["b4", "y3", "base", "Nc6"],
    ]);
    expect(sans(baseLine(graph, "base"))).toEqual(["e4", "e5", "Nf3"]);
  });
});

describe("baseHeading", () => {
  test("reads Start position without a base", () => {
    expect(baseHeading([])).toBe("Start position");
  });

  test("reads the base moves in move-pair notation", () => {
    expect(baseHeading(baseLine(scotch, "p6"))).toBe("Base: 1. e4 e5 2. Nf3 Nc6 3. d4 exd4");
  });

  test("numbers a base with Black to move", () => {
    expect(baseHeading(baseLine(scotch, "p1"))).toBe("Base: 1. e4");
  });

  test("numbers a base with White to move", () => {
    expect(baseHeading(baseLine(scotch, "p2"))).toBe("Base: 1. e4 e5");
    expect(baseHeading(baseLine(scotch, "p3"))).toBe("Base: 1. e4 e5 2. Nf3");
  });
});

describe("canSetBase", () => {
  test("is false at the start position and at the current base", () => {
    expect(canSetBase("start", "start", null)).toBe(false);
    expect(canSetBase("p3", "start", "p3")).toBe(false);
  });

  test("is true at any other position", () => {
    expect(canSetBase("p3", "start", null)).toBe(true);
    expect(canSetBase("p3", "start", "p6")).toBe(true);
  });
});

describe("basePly", () => {
  const path = baseLine(scotch, "p7");

  test("is the number of plies up to the base when the line passes through it", () => {
    expect(basePly(path, "p6")).toBe(6);
    expect(basePly(path.slice(0, 6), "p6")).toBe(6);
  });

  test("is null without a base, or when the line does not reach it", () => {
    expect(basePly(path, null)).toBeNull();
    expect(basePly(path.slice(0, 3), "p6")).toBeNull();
    expect(basePly([], "p6")).toBeNull();
  });
});
