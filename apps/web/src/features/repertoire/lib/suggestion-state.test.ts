import { describe, expect, test } from "bun:test";

import type { EngineInfo, EngineLine, EngineResult } from "@/features/engine";

import {
  INITIAL_SUGGESTION_STATE,
  suggestionReducer,
  toEngineView,
  type SuggestionEvent,
  type SuggestionState,
} from "./suggestion-state";

const MAX_DEPTH = 18;
const MAX_PLIES = 8;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
// Fool's mate: White is checkmated.
const MATED = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

const line = (multipv: number, depth: number, cp: number, pv: string[]): EngineLine => ({
  multipv,
  depth,
  score: { kind: "cp", value: cp },
  pv,
});

const info = (depth: number, lines: EngineLine[]): EngineInfo => {
  const first = lines[0];
  if (!first) throw new Error("fixture needs a line");
  return { depth, score: first.score, pv: first.pv, lines };
};

const result = (depth: number, lines: EngineLine[]): EngineResult => ({
  bestMove: lines[0]?.pv[0] ?? null,
  score: lines[0]?.score ?? null,
  depth,
  pv: lines[0]?.pv ?? [],
  lines,
});

const run = (events: SuggestionEvent[], from: SuggestionState = INITIAL_SUGGESTION_STATE) =>
  events.reduce(suggestionReducer, from);

const E4_LINES = [line(1, 12, 30, ["e2e4", "e7e5"]), line(2, 12, 20, ["d2d4", "d7d5"])];

describe("suggestionReducer", () => {
  test("starts off", () => {
    expect(INITIAL_SUGGESTION_STATE).toEqual({ kind: "off" });
  });

  test("started moves to starting for that job and position", () => {
    expect(run([{ type: "started", job: 1, fen: START }])).toEqual({
      kind: "starting",
      job: 1,
      fen: START,
    });
  });

  test("progress moves starting to analysing with the depth and lines", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
    ]);
    expect(state).toEqual({ kind: "analysing", job: 1, fen: START, depth: 12, lines: E4_LINES });
  });

  test("finished moves to done with the final depth and lines", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
      { type: "finished", job: 1, result: result(18, E4_LINES) },
    ]);
    expect(state).toEqual({ kind: "done", job: 1, fen: START, depth: 18, lines: E4_LINES });
  });

  test("finished without any progress still ends done", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "finished", job: 1, result: result(18, E4_LINES) },
    ]);
    expect(state.kind).toBe("done");
  });

  test("failed moves to unavailable", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "failed", job: 1 },
    ]);
    expect(state).toEqual({ kind: "unavailable", job: 1, fen: START });
  });

  test("terminal marks a position with no legal moves", () => {
    expect(run([{ type: "terminal", job: 1, fen: MATED }])).toEqual({
      kind: "terminal",
      job: 1,
      fen: MATED,
    });
  });

  test("disabled returns to off from any state", () => {
    const analysing = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
    ]);
    expect(run([{ type: "disabled" }], analysing)).toEqual({ kind: "off" });
  });

  test("a new job replaces the previous state, lines included", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
      { type: "started", job: 2, fen: AFTER_E4 },
    ]);
    expect(state).toEqual({ kind: "starting", job: 2, fen: AFTER_E4 });
  });

  test("progress from an older job never lands in a newer position's state", () => {
    const starting = run([
      { type: "started", job: 1, fen: START },
      { type: "started", job: 2, fen: AFTER_E4 },
    ]);
    expect(run([{ type: "progress", job: 1, info: info(14, E4_LINES) }], starting)).toBe(starting);
    expect(run([{ type: "finished", job: 1, result: result(18, E4_LINES) }], starting)).toBe(
      starting,
    );
    expect(run([{ type: "failed", job: 1 }], starting)).toBe(starting);
  });

  test("events for a job that was switched off are ignored", () => {
    const off = run([{ type: "started", job: 1, fen: START }, { type: "disabled" }]);
    expect(run([{ type: "progress", job: 1, info: info(14, E4_LINES) }], off)).toBe(off);
    expect(run([{ type: "finished", job: 1, result: result(18, E4_LINES) }], off)).toBe(off);
    expect(run([{ type: "failed", job: 1 }], off)).toBe(off);
  });

  test("a finished search is not reopened by a late progress or failure", () => {
    const done = run([
      { type: "started", job: 1, fen: START },
      { type: "finished", job: 1, result: result(18, E4_LINES) },
    ]);
    expect(run([{ type: "progress", job: 1, info: info(20, E4_LINES) }], done)).toBe(done);
    expect(run([{ type: "failed", job: 1 }], done)).toBe(done);
  });
});

describe("toEngineView", () => {
  const view = (state: SuggestionState, fen = START, enabled = true) =>
    toEngineView({ state, fen, enabled, childMoves: [], maxDepth: MAX_DEPTH, maxPlies: MAX_PLIES });

  test("disabled is off, whatever the state holds", () => {
    const state = run([{ type: "started", job: 1, fen: START }]);
    expect(view(state, START, false)).toEqual({
      panel: { kind: "off" },
      whitePercent: null,
      arrow: null,
    });
  });

  test("enabled before the first job starts shows starting, not off", () => {
    expect(view(INITIAL_SUGGESTION_STATE).panel).toEqual({ kind: "starting" });
  });

  test("a state for another position shows starting, never its old lines", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
    ]);
    expect(view(state, AFTER_E4)).toEqual({
      panel: { kind: "starting" },
      whitePercent: null,
      arrow: null,
    });
  });

  test("analysing carries the depth, the target depth and the suggestion lines", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(12, E4_LINES) },
    ]);
    const { panel } = view(state);
    if (panel.kind !== "analysing") throw new Error("expected analysing");
    expect(panel.depth).toBe(12);
    expect(panel.maxDepth).toBe(MAX_DEPTH);
    expect(panel.lines.map((l) => l.firstMove.san)).toEqual(["e4", "d4"]);
    expect(panel.lines[0]?.scoreText).toBe("+0.30");
  });

  test("the eval percent and the arrow follow line 1", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "finished", job: 1, result: result(18, E4_LINES) },
    ]);
    const out = view(state);
    expect(out.panel.kind).toBe("done");
    expect(out.whitePercent).toBeGreaterThan(50);
    expect(out.arrow).toEqual({ from: "e2", to: "e4" });
  });

  test("the eval is from White's side when Black is to move", () => {
    const state = run([
      { type: "started", job: 1, fen: AFTER_E4 },
      { type: "progress", job: 1, info: info(10, [line(1, 10, 40, ["e7e5"])]) },
    ]);
    expect(view(state, AFTER_E4).whitePercent).toBeLessThan(50);
  });

  test("marks a first move already in the repertoire", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "finished", job: 1, result: result(18, E4_LINES) },
    ]);
    const { panel } = toEngineView({
      state,
      fen: START,
      enabled: true,
      childMoves: [{ san: "e4" }],
      maxDepth: MAX_DEPTH,
      maxPlies: MAX_PLIES,
    });
    if (panel.kind !== "done") throw new Error("expected done");
    expect(panel.lines.map((l) => l.inRepertoire)).toEqual([true, false]);
  });

  test("lines that are not legal here are dropped, so no bar or arrow comes from them", () => {
    const state = run([
      { type: "started", job: 1, fen: START },
      { type: "progress", job: 1, info: info(5, [line(1, 5, 30, ["e7e5"])]) },
    ]);
    const out = view(state);
    expect(out.panel).toEqual({ kind: "analysing", depth: 5, maxDepth: MAX_DEPTH, lines: [] });
    expect(out.whitePercent).toBeNull();
    expect(out.arrow).toBeNull();
  });

  test("unavailable and terminal carry no bar or arrow", () => {
    const unavailable = run([
      { type: "started", job: 1, fen: START },
      { type: "failed", job: 1 },
    ]);
    expect(view(unavailable)).toEqual({
      panel: { kind: "unavailable" },
      whitePercent: null,
      arrow: null,
    });
    const terminal = run([{ type: "terminal", job: 1, fen: MATED }]);
    expect(view(terminal, MATED)).toEqual({
      panel: { kind: "terminal" },
      whitePercent: null,
      arrow: null,
    });
  });
});
