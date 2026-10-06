import { describe, expect, test } from "bun:test";

import {
  arrowDescription,
  formatClock,
  formatEval,
  isNotFound,
  lichessGameUrl,
  moveArrows,
  moveLabel,
  movesFromPgn,
  PLAYED_ARROW_COLOR,
  pawns,
  phaseLabel,
  severityLabel,
  uciSquares,
} from "./mistake-format";
import { validateMistakesSearch } from "./mistakes-search";

describe("labels", () => {
  test("severity and phase read as words", () => {
    expect(severityLabel("blunder")).toBe("Blunder");
    expect(severityLabel("inaccuracy")).toBe("Inaccuracy");
    expect(phaseLabel("endgame")).toBe("Endgame");
  });

  test("a move label carries the move number, with dots for Black", () => {
    expect(moveLabel(1, "e4")).toBe("1. e4");
    expect(moveLabel(5, "Nf3")).toBe("3. Nf3");
    expect(moveLabel(6, "Nc6")).toBe("3... Nc6");
  });
});

describe("evaluations", () => {
  test("pawns have one decimal", () => {
    expect(pawns(120)).toBe("1.2");
    expect(pawns(-45)).toBe("-0.5");
  });

  test("evaluations are signed from the mover's side", () => {
    expect(formatEval(120)).toBe("+1.2");
    expect(formatEval(-40)).toBe("-0.4");
    expect(formatEval(0)).toBe("0.0");
  });

  test("forced mates are spelled out, not shown as pawns", () => {
    expect(formatEval(1000)).toBe("Mate for you");
    expect(formatEval(-1000)).toBe("Mate against you");
  });

  test("the clock is m:ss, or null without clock data", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(9_400)).toBe("0:09");
    expect(formatClock(null)).toBeNull();
  });
});

describe("arrows", () => {
  test("reads the squares of a UCI move, including a promotion", () => {
    expect(uciSquares("e2e4")).toEqual({ from: "e2", to: "e4" });
    expect(uciSquares("e7e8q")).toEqual({ from: "e7", to: "e8" });
    expect(uciSquares("nonsense")).toBeNull();
  });

  test("draws the played move in red and the best move last in the default colour", () => {
    expect(moveArrows({ playedUci: "a2a3", bestUci: "g1f3" })).toEqual([
      { from: "a2", to: "a3", color: PLAYED_ARROW_COLOR },
      { from: "g1", to: "f3" },
    ]);
  });

  test("skips a move that is not valid UCI instead of drawing a broken arrow", () => {
    expect(moveArrows({ playedUci: "", bestUci: "g1f3" })).toEqual([{ from: "g1", to: "f3" }]);
  });

  test("the text alternative names both moves and their colours", () => {
    expect(arrowDescription({ playedSan: "a3", bestSan: "Nf3" })).toBe(
      "red arrow: you played a3. green arrow: best move Nf3.",
    );
  });
});

describe("game helpers", () => {
  test("lists the SAN moves of a PGN, and nothing for an unreadable one", () => {
    expect(movesFromPgn('[Event "x"]\n\n1. e4 e5 2. Nf3 *')).toEqual(["e4", "e5", "Nf3"]);
    expect(movesFromPgn("1. Zz9 garbage")).toEqual([]);
  });

  test("builds the Lichess game link from the game id", () => {
    expect(lichessGameUrl({ lichessGameId: "abcd1234" })).toBe("https://lichess.org/abcd1234");
  });

  test("recognises a NOT_FOUND error", () => {
    expect(isNotFound({ code: "NOT_FOUND" })).toBe(true);
    expect(isNotFound({ code: "INTERNAL_SERVER_ERROR" })).toBe(false);
    expect(isNotFound(new Error("x"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("validateMistakesSearch", () => {
  test("keeps a game id and drops anything else", () => {
    expect(validateMistakesSearch({ gameId: "g1", other: 1 })).toEqual({ gameId: "g1" });
    expect(validateMistakesSearch({ gameId: "" })).toEqual({});
    expect(validateMistakesSearch({ gameId: 5 })).toEqual({});
    expect(validateMistakesSearch({})).toEqual({});
  });
});
