import { describe, expect, test } from "bun:test";

import {
  describeChildMove,
  findMove,
  lineFens,
  parseArrowInput,
  parseSquareInput,
  positionAfterRemoval,
  resolvePosition,
  toggleHighlightInput,
} from "./builder-state";
import { IDEA_NOTE_MAX_ITEMS as MAX_NOTE_ITEMS } from "@b2c-template/api/lib/repertoire-limits";
import type { RepertoireData } from "./repertoire-types";

/** start -e4-> p1 -e5-> p2 ; start -d4-> p3 */
const graph: Pick<RepertoireData, "startPositionId" | "positions" | "moves"> = {
  startPositionId: "start",
  positions: ["start", "p1", "p2", "p3"].map((id) => ({
    id,
    key: `key-${id}` as RepertoireData["positions"][number]["key"],
    fen: `fen-${id}`,
    sideToMove: "w",
  })),
  moves: [
    {
      id: "m1",
      fromPositionId: "start",
      toPositionId: "p1",
      san: "e4",
      uci: "e2e4",
      name: null,
      isUserMove: true,
    },
    {
      id: "m2",
      fromPositionId: "p1",
      toPositionId: "p2",
      san: "e5",
      uci: "e7e5",
      name: null,
      isUserMove: false,
    },
    {
      id: "m3",
      fromPositionId: "start",
      toPositionId: "p3",
      san: "d4",
      uci: "d2d4",
      name: null,
      isUserMove: true,
    },
  ],
};

describe("parseSquareInput", () => {
  test("accepts a square in any case with surrounding spaces", () => {
    expect(parseSquareInput(" E4 ")).toEqual({ ok: true, square: "e4" });
  });

  test("rejects anything that is not a square, with a message", () => {
    for (const text of ["", "e9", "i4", "e44", "knight"]) {
      const result = parseSquareInput(text);
      expect(result.ok).toBe(false);
    }
    expect(parseSquareInput("")).toEqual({ ok: false, error: "Type a square, for example e4." });
  });
});

describe("parseArrowInput", () => {
  test("builds an arrow from two squares", () => {
    expect(parseArrowInput("G1", "f3", [])).toEqual({ ok: true, arrow: { from: "g1", to: "f3" } });
  });

  test("names the field that is wrong", () => {
    expect(parseArrowInput("z1", "f3", [])).toEqual({
      ok: false,
      error: "From square: type a square, for example e4.",
    });
    expect(parseArrowInput("g1", "", [])).toEqual({
      ok: false,
      error: "To square: type a square, for example e4.",
    });
  });

  test("rejects an arrow onto its own square and a repeated arrow", () => {
    expect(parseArrowInput("e4", "e4", [])).toEqual({
      ok: false,
      error: "An arrow needs two different squares.",
    });
    expect(parseArrowInput("g1", "f3", [{ from: "g1", to: "f3" }])).toEqual({
      ok: false,
      error: "That arrow is already on the board.",
    });
  });

  test("rejects an arrow past the cap", () => {
    const full = Array.from({ length: MAX_NOTE_ITEMS }, (_, i) => ({
      from: "a1",
      to: `${"abcdefgh"[i % 8]}${(i % 7) + 2}`,
    }));
    const result = parseArrowInput("h1", "h8", full);
    expect(result).toEqual({
      ok: false,
      error: `A note holds at most ${MAX_NOTE_ITEMS} arrows.`,
    });
  });
});

describe("toggleHighlightInput", () => {
  test("adds a typed square", () => {
    expect(toggleHighlightInput(" E4 ", ["d5"])).toEqual({ ok: true, highlights: ["d5", "e4"] });
  });

  test("removes a typed square that is already highlighted", () => {
    expect(toggleHighlightInput("d5", ["d5", "e4"])).toEqual({ ok: true, highlights: ["e4"] });
  });

  test("rejects text that is not a square", () => {
    expect(toggleHighlightInput("z9", [])).toEqual({
      ok: false,
      error: '"z9" is not a square. Use a file a-h and a rank 1-8.',
    });
  });

  test("rejects a new square past the cap but still removes one", () => {
    const full = Array.from(
      { length: MAX_NOTE_ITEMS },
      (_, i) => `${"abcdefgh"[i % 8]}${(i % 4) + 1}`,
    );
    expect(toggleHighlightInput("h8", full)).toEqual({
      ok: false,
      error: `A note holds at most ${MAX_NOTE_ITEMS} highlighted squares.`,
    });
    expect(toggleHighlightInput("a1", full)).toEqual({
      ok: true,
      highlights: full.filter((square) => square !== "a1"),
    });
  });
});

describe("resolvePosition", () => {
  test("keeps a position that exists", () => {
    expect(resolvePosition(graph, "p2")).toBe("p2");
  });

  test("falls back to the start position when it is gone", () => {
    expect(resolvePosition(graph, "gone")).toBe("start");
    expect(resolvePosition(graph, null)).toBe("start");
  });
});

describe("positionAfterRemoval", () => {
  test("moves to where the removed move began when the current position goes with it", () => {
    expect(positionAfterRemoval(graph, "m2", "p2")).toBe("p1");
    expect(positionAfterRemoval(graph, "m1", "p2")).toBe("start");
  });

  test("stays put when the current position survives", () => {
    expect(positionAfterRemoval(graph, "m2", "p1")).toBe("p1");
    expect(positionAfterRemoval(graph, "m3", "p2")).toBe("p2");
  });
});

describe("describeChildMove", () => {
  test("numbers the move by the ply it would be played at", () => {
    expect(describeChildMove(0, "e4")).toBe("1. e4");
    expect(describeChildMove(1, "e5")).toBe("1... e5");
    expect(describeChildMove(4, "Nf3")).toBe("3. Nf3");
  });
});

describe("lineFens", () => {
  const [m1, m2] = graph.moves;

  test("is the start position alone for an empty line", () => {
    expect(lineFens(graph, [])).toEqual(["fen-start"]);
  });

  test("runs from the start position through each move's position", () => {
    expect(lineFens(graph, [m1, m2])).toEqual(["fen-start", "fen-p1", "fen-p2"]);
  });

  test("drops a position the graph does not hold, and keeps the rest in order", () => {
    const missing = { ...m2, toPositionId: "gone" };
    expect(lineFens(graph, [m1, missing])).toEqual(["fen-start", "fen-p1"]);
  });

  test("is empty when the start position itself is missing", () => {
    expect(lineFens({ ...graph, startPositionId: "gone" }, [])).toEqual([]);
  });
});

describe("findMove", () => {
  test("finds a move by its id", () => {
    expect(findMove(graph, "m2")?.san).toBe("e5");
  });

  test("is undefined for an id the graph does not hold", () => {
    expect(findMove(graph, "nope")).toBeUndefined();
  });
});
