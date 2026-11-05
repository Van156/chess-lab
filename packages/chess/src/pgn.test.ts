import { describe, expect, test } from "bun:test";
import { parseGame } from "./pgn";

const WITH_CLOCKS = `[Event "Rated Blitz game"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[TimeControl "300+3"]

1. e4 { [%clk 0:05:00] } 1... e5 { [%clk 0:04:58.5] } 2. Nf3 { [%clk 0:04:50] } 2... Nc6 { [%clk 0:04:40] } 1-0`;

const NO_CLOCKS = `[Event "Casual"]
[TimeControl "-"]

1. d4 d5 2. c4 *`;

const CUSTOM_FEN = `[Event "Endgame"]
[SetUp "1"]
[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]

1. e4 Kd7 *`;

describe("parseGame", () => {
  test("returns headers", () => {
    const g = parseGame(WITH_CLOCKS);
    expect(g.headers.White).toBe("alice");
    expect(g.headers.TimeControl).toBe("300+3");
  });

  test("returns plies with fenBefore, san, uci, color and clocks", () => {
    const { plies } = parseGame(WITH_CLOCKS);
    expect(plies).toHaveLength(4);
    expect(plies[0]).toMatchObject({
      ply: 1,
      san: "e4",
      uci: "e2e4",
      color: "w",
      clockMs: 300_000,
      fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
    expect(plies[1]).toMatchObject({ ply: 2, color: "b", clockMs: 298_500 });
    expect(plies[3]?.clockMs).toBe(280_000);
  });

  test("initial clock comes from TimeControl", () => {
    expect(parseGame(WITH_CLOCKS).initialClockMs).toBe(300_000);
  });

  test("missing clocks are null", () => {
    const g = parseGame(NO_CLOCKS);
    expect(g.plies.map((p) => p.clockMs)).toEqual([null, null, null]);
    expect(g.initialClockMs).toBeNull();
  });

  test("honours a non-standard start FEN", () => {
    const g = parseGame(CUSTOM_FEN);
    expect(g.plies[0]?.fenBefore).toBe("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    expect(g.plies.map((p) => p.color)).toEqual(["w", "b"]);
  });

  test("throws on invalid PGN", () => {
    expect(() => parseGame("1. e4 e4")).toThrow();
  });
});
