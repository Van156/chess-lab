import { describe, expect, test } from "bun:test";

import {
  buildGo,
  buildMultiPvOption,
  buildPosition,
  buildSetOption,
  buildStrengthOptions,
  clampElo,
  parseUciLine,
} from "./uci";

describe("parseUciLine: info", () => {
  test("parses depth, centipawn score and the principal variation", () => {
    expect(
      parseUciLine(
        "info depth 12 seldepth 18 multipv 1 score cp 34 nodes 5123 nps 250000 time 20 pv e2e4 e7e5 g1f3",
      ),
    ).toEqual({
      type: "info",
      depth: 12,
      score: { kind: "cp", value: 34 },
      pv: ["e2e4", "e7e5", "g1f3"],
      multipv: 1,
    });
  });

  test("parses a negative mate score", () => {
    expect(parseUciLine("info depth 20 score mate -3 pv h7h8 a1a2")).toEqual({
      type: "info",
      depth: 20,
      score: { kind: "mate", value: -3 },
      pv: ["h7h8", "a1a2"],
      multipv: 1,
    });
  });

  test("ignores bound markers after the score but keeps the value", () => {
    const parsed = parseUciLine("info depth 8 score cp -12 lowerbound pv d2d4");
    expect(parsed).toMatchObject({ type: "info", score: { kind: "cp", value: -12 } });
  });

  test("an info line with a score but no pv has an empty pv", () => {
    expect(parseUciLine("info depth 1 score cp 0")).toMatchObject({ type: "info", pv: [] });
  });

  test("info lines without depth and score are not results", () => {
    expect(parseUciLine("info string NNUE evaluation using nn.nnue")).toEqual({
      type: "other",
      line: "info string NNUE evaluation using nn.nnue",
    });
    expect(parseUciLine("info depth 5 currmove e2e4 currmovenumber 1")).toMatchObject({
      type: "other",
    });
  });

  test("reads the multipv index", () => {
    expect(parseUciLine("info depth 9 multipv 2 score cp 5 pv a2a3")).toMatchObject({
      multipv: 2,
    });
  });
});

describe("parseUciLine: bestmove", () => {
  test("parses the move and the ponder move", () => {
    expect(parseUciLine("bestmove e2e4 ponder e7e5")).toEqual({
      type: "bestmove",
      move: "e2e4",
      ponder: "e7e5",
    });
  });

  test("parses a bare bestmove", () => {
    expect(parseUciLine("bestmove g1f3")).toEqual({ type: "bestmove", move: "g1f3" });
  });

  test("(none) means no legal move", () => {
    expect(parseUciLine("bestmove (none)")).toEqual({ type: "bestmove", move: null });
  });
});

describe("parseUciLine: options and handshake", () => {
  test("parses a spin option with range and default", () => {
    expect(parseUciLine("option name UCI_Elo type spin default 1320 min 1320 max 3190")).toEqual({
      type: "spin-option",
      name: "UCI_Elo",
      min: 1320,
      max: 3190,
      default: 1320,
    });
  });

  test("keeps multi-word option names", () => {
    expect(parseUciLine("option name Skill Level type spin default 20 min 0 max 20")).toEqual({
      type: "spin-option",
      name: "Skill Level",
      min: 0,
      max: 20,
      default: 20,
    });
  });

  test("non-spin options are other lines", () => {
    expect(parseUciLine("option name Ponder type check default false")).toMatchObject({
      type: "other",
    });
  });

  test("recognises uciok and readyok, tolerating whitespace", () => {
    expect(parseUciLine("uciok")).toEqual({ type: "uciok" });
    expect(parseUciLine("  readyok \r")).toEqual({ type: "readyok" });
  });

  test("unknown and empty lines are other", () => {
    expect(parseUciLine("")).toEqual({ type: "other", line: "" });
    expect(parseUciLine("id name Stockfish 19 Lite WASM")).toMatchObject({ type: "other" });
  });
});

describe("command builders", () => {
  test("go with a depth or a movetime", () => {
    expect(buildGo({ depth: 18 })).toBe("go depth 18");
    expect(buildGo({ movetimeMs: 500 })).toBe("go movetime 500");
  });

  test("setoption with and without a value", () => {
    expect(buildSetOption("Hash", 16)).toBe("setoption name Hash value 16");
    expect(buildSetOption("UCI_LimitStrength", false)).toBe(
      "setoption name UCI_LimitStrength value false",
    );
    expect(buildSetOption("Clear Hash")).toBe("setoption name Clear Hash");
  });

  test("position from a fen, optionally followed by moves", () => {
    expect(buildPosition("8/8/8/8/8/8/8/K1k5 w - - 0 1")).toBe(
      "position fen 8/8/8/8/8/8/8/K1k5 w - - 0 1",
    );
    expect(buildPosition("8/8/8/8/8/8/8/K1k5 w - - 0 1", ["a1a2"])).toBe(
      "position fen 8/8/8/8/8/8/8/K1k5 w - - 0 1 moves a1a2",
    );
  });
});

describe("strength options", () => {
  test("analysis (no strength) resets limiting and skill", () => {
    expect(buildStrengthOptions(undefined)).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
    ]);
  });

  test("an elo strength limits strength and sets UCI_Elo", () => {
    expect(buildStrengthOptions({ elo: 1800 })).toEqual([
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 1800",
    ]);
  });

  test("a skill strength disables elo limiting and sets Skill Level", () => {
    expect(buildStrengthOptions({ skill: 3 })).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 3",
    ]);
  });

  test("MultiPV defaults to 1 so a job never inherits the previous line count", () => {
    expect(buildMultiPvOption(undefined)).toBe("setoption name MultiPV value 1");
  });

  test("MultiPV carries the requested line count, floored at 1", () => {
    expect(buildMultiPvOption(3)).toBe("setoption name MultiPV value 3");
    expect(buildMultiPvOption(0)).toBe("setoption name MultiPV value 1");
    expect(buildMultiPvOption(2.7)).toBe("setoption name MultiPV value 2");
  });

  test("clampElo keeps an elo inside the supported range and rounds it", () => {
    const range = { min: 1320, max: 3190 };
    expect(clampElo(range, 1000)).toBe(1320);
    expect(clampElo(range, 4000)).toBe(3190);
    expect(clampElo(range, 1800.4)).toBe(1800);
  });
});
