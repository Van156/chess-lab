import { describe, expect, test } from "bun:test";

import {
  ALL_SQUARES,
  diagonalsThrough,
  formatSquare,
  knightDistance,
  knightPath,
  fileAndRank,
  parseSquare,
  squareColour,
} from "./squares";

describe("parseSquare / formatSquare", () => {
  test("parses algebraic squares to zero-based file and rank", () => {
    expect(parseSquare("a1")).toEqual({ file: 0, rank: 0 });
    expect(parseSquare("h8")).toEqual({ file: 7, rank: 7 });
    expect(parseSquare("f6")).toEqual({ file: 5, rank: 5 });
  });

  test("accepts surrounding whitespace and upper case", () => {
    expect(parseSquare(" E4 ")).toEqual({ file: 4, rank: 3 });
  });

  test("rejects anything that is not a square", () => {
    for (const input of ["", "a", "a9", "i1", "a0", "e44", "1a", "e 4"]) {
      expect(parseSquare(input)).toBeNull();
    }
  });

  test("formatSquare round-trips every square", () => {
    expect(ALL_SQUARES).toHaveLength(64);
    for (const square of ALL_SQUARES) {
      const parsed = parseSquare(square);
      expect(parsed && formatSquare(parsed.file, parsed.rank)).toBe(square);
    }
  });
});

describe("squareColour", () => {
  test("a1 is dark and h1 is light", () => {
    expect(squareColour("a1")).toBe("dark");
    expect(squareColour("h1")).toBe("light");
  });

  test("known squares", () => {
    expect(squareColour("h8")).toBe("dark");
    expect(squareColour("a8")).toBe("light");
    expect(squareColour("d4")).toBe("dark");
    expect(squareColour("e4")).toBe("light");
    expect(squareColour("f6")).toBe("dark");
  });

  test("half of the board is dark", () => {
    expect(ALL_SQUARES.filter((square) => squareColour(square) === "dark")).toHaveLength(32);
  });
});

describe("diagonalsThrough", () => {
  test("the long diagonals, ordered by file", () => {
    expect(diagonalsThrough("c3").rising).toEqual(["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]);
    expect(diagonalsThrough("c3").falling).toEqual(["a5", "b4", "c3", "d2", "e1"]);
  });

  test("corner squares sit on a single-square falling or rising line", () => {
    expect(diagonalsThrough("a1").falling).toEqual(["a1"]);
    expect(diagonalsThrough("h1").rising).toEqual(["h1"]);
    expect(diagonalsThrough("h1").falling).toEqual([
      "a8",
      "b7",
      "c6",
      "d5",
      "e4",
      "f3",
      "g2",
      "h1",
    ]);
  });

  test("both diagonals contain the square and share its colour", () => {
    for (const square of ALL_SQUARES) {
      const { rising, falling } = diagonalsThrough(square);
      expect(rising).toContain(square);
      expect(falling).toContain(square);
      for (const other of [...rising, ...falling]) {
        expect(squareColour(other)).toBe(squareColour(square));
      }
    }
  });
});

describe("knightDistance", () => {
  test("zero for the same square", () => {
    expect(knightDistance("e4", "e4")).toBe(0);
  });

  test("one knight move", () => {
    expect(knightDistance("b1", "c3")).toBe(1);
    expect(knightDistance("g1", "f3")).toBe(1);
  });

  test("known distances", () => {
    expect(knightDistance("a1", "b2")).toBe(4);
    expect(knightDistance("a1", "h8")).toBe(6);
    expect(knightDistance("b1", "b2")).toBe(3);
    expect(knightDistance("b1", "c2")).toBe(2);
    expect(knightDistance("b1", "f7")).toBe(4);
  });

  test("is symmetric and stays within 0..6 for every pair", () => {
    for (const from of ALL_SQUARES) {
      for (const to of ALL_SQUARES) {
        const distance = knightDistance(from, to);
        expect(distance).toBe(knightDistance(to, from));
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(6);
      }
    }
  });

  test("parity: same colour needs an even number of moves, opposite colour an odd one", () => {
    for (const from of ALL_SQUARES) {
      for (const to of ALL_SQUARES) {
        const sameColour = squareColour(from) === squareColour(to);
        expect(knightDistance(from, to) % 2 === 0).toBe(sameColour);
      }
    }
  });
});

describe("knightPath", () => {
  const isKnightHop = (a: string, b: string) => {
    const from = parseSquare(a);
    const to = parseSquare(b);
    if (!from || !to) return false;
    const df = Math.abs(from.file - to.file);
    const dr = Math.abs(from.rank - to.rank);
    return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  };

  test("is just the square when start and target match", () => {
    expect(knightPath("e4", "e4")).toEqual(["e4"]);
  });

  test("runs from start to target in knight hops, as short as the distance", () => {
    for (const [from, to] of [
      ["b1", "c3"],
      ["a1", "h8"],
      ["a1", "b2"],
      ["g1", "e5"],
      ["d4", "h1"],
    ] as const) {
      const path = knightPath(from, to);
      expect(path[0]).toBe(from);
      expect(path.at(-1)).toBe(to);
      expect(path).toHaveLength(knightDistance(from, to) + 1);
      for (let index = 1; index < path.length; index++) {
        expect(isKnightHop(path[index - 1] ?? "", path[index] ?? "")).toBe(true);
      }
    }
  });

  test("is deterministic", () => {
    expect(knightPath("a1", "h8")).toEqual(knightPath("a1", "h8"));
  });
});

describe("fileAndRank", () => {
  test("splits a square into its file letter and rank number", () => {
    expect(fileAndRank("e4")).toEqual({ file: "e", fileNumber: 5, rank: 4 });
  });
});
