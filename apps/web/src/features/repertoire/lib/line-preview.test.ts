import { describe, expect, test } from "bun:test";

import { START_FEN } from "@b2c-template/chess";

import {
  IDLE_PREVIEW,
  linePreviewReducer,
  previewKeyAction,
  previewSteps,
  previewView,
  type LinePreview,
} from "./line-preview";

const PV = ["e2e4", "e7e5", "g1f3", "b8c6"];

const started = (pv: readonly string[] = PV, rank = 1): LinePreview =>
  linePreviewReducer(IDLE_PREVIEW, { type: "start", rank, baseFen: START_FEN, pv });

describe("previewSteps", () => {
  test("replays the line, with each move's SAN and the position after it", () => {
    const steps = previewSteps(START_FEN, PV);
    expect(steps.map((step) => step.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(steps.map((step) => step.uci)).toEqual(PV);
    expect(steps[0]?.fenAfter).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
  });

  test("truncates at the first illegal move", () => {
    expect(previewSteps(START_FEN, ["e2e4", "e7e5", "e4e6", "b8c6"]).map((s) => s.uci)).toEqual([
      "e2e4",
      "e7e5",
    ]);
  });

  test("truncates at a malformed move, and gives nothing for an empty line", () => {
    expect(previewSteps(START_FEN, ["e2e4", "zz", "e7e5"])).toHaveLength(1);
    expect(previewSteps(START_FEN, [])).toEqual([]);
    expect(previewSteps(START_FEN, ["e7e5"])).toEqual([]);
  });

  test("gives nothing for a position that cannot be loaded", () => {
    expect(previewSteps("not a fen", PV)).toEqual([]);
  });
});

describe("linePreviewReducer", () => {
  test("starts after the first move of the line", () => {
    const state = started();
    expect(state.kind).toBe("previewing");
    expect(previewView(state, START_FEN)?.cursor).toBe(1);
    expect(previewView(state, START_FEN)?.fen).toBe(previewSteps(START_FEN, PV)[0]?.fenAfter);
  });

  test("does not start on a line without a legal first move", () => {
    expect(started([], 0)).toBe(IDLE_PREVIEW);
    expect(started(["e7e5"], 0)).toBe(IDLE_PREVIEW);
  });

  test("next and previous move the cursor within 1 and the line's length", () => {
    let state = started();
    state = linePreviewReducer(state, { type: "next" });
    expect(previewView(state, START_FEN)?.cursor).toBe(2);
    state = linePreviewReducer(state, { type: "previous" });
    expect(previewView(state, START_FEN)?.cursor).toBe(1);
    for (let index = 0; index < 10; index += 1) {
      state = linePreviewReducer(state, { type: "next" });
    }
    expect(previewView(state, START_FEN)?.cursor).toBe(4);
  });

  test("returns the same state when a step would leave the bounds", () => {
    const first = started();
    expect(linePreviewReducer(first, { type: "previous" })).toBe(first);
    const last = [1, 2, 3].reduce<LinePreview>(
      (state) => linePreviewReducer(state, { type: "next" }),
      first,
    );
    expect(linePreviewReducer(last, { type: "next" })).toBe(last);
  });

  test("starting another line replaces the preview", () => {
    const next = linePreviewReducer(started(), {
      type: "start",
      rank: 2,
      baseFen: START_FEN,
      pv: ["d2d4", "d7d5"],
    });
    expect(previewView(next, START_FEN)?.rank).toBe(2);
    expect(previewView(next, START_FEN)?.total).toBe(2);
    expect(previewView(next, START_FEN)?.cursor).toBe(1);
  });

  test("exit returns to idle, and steps while idle change nothing", () => {
    expect(linePreviewReducer(started(), { type: "exit" })).toBe(IDLE_PREVIEW);
    expect(linePreviewReducer(IDLE_PREVIEW, { type: "exit" })).toBe(IDLE_PREVIEW);
    expect(linePreviewReducer(IDLE_PREVIEW, { type: "next" })).toBe(IDLE_PREVIEW);
    expect(linePreviewReducer(IDLE_PREVIEW, { type: "previous" })).toBe(IDLE_PREVIEW);
  });
});

describe("previewView", () => {
  test("is null while idle", () => {
    expect(previewView(IDLE_PREVIEW, START_FEN)).toBeNull();
  });

  test("is null once the builder shows another position than the one the line started from", () => {
    expect(previewView(started(), previewSteps(START_FEN, PV)[0]?.fenAfter ?? "")).toBeNull();
  });

  test("shows the position at the cursor, the move just played and the next one to draw", () => {
    const view = previewView(linePreviewReducer(started(), { type: "next" }), START_FEN);
    expect(view).toMatchObject({
      rank: 1,
      cursor: 2,
      total: 4,
      san: "e5",
      lastMove: { from: "e7", to: "e5" },
      nextArrow: { from: "g1", to: "f3" },
      canPrevious: true,
      canNext: true,
    });
  });

  test("has no next arrow and cannot step on at the end of the line", () => {
    const end = [1, 2, 3].reduce<LinePreview>(
      (state) => linePreviewReducer(state, { type: "next" }),
      started(),
    );
    expect(previewView(end, START_FEN)).toMatchObject({
      cursor: 4,
      nextArrow: null,
      canNext: false,
    });
  });

  test("cannot step back from the first move", () => {
    expect(previewView(started(), START_FEN)).toMatchObject({ canPrevious: false, canNext: true });
  });
});

describe("previewKeyAction", () => {
  test("maps the arrows to steps and Escape to exit", () => {
    expect(previewKeyAction("ArrowRight", false)).toEqual({ type: "next" });
    expect(previewKeyAction("ArrowLeft", false)).toEqual({ type: "previous" });
    expect(previewKeyAction("Escape", false)).toEqual({ type: "exit" });
  });

  test("leaves the arrows to the focused control when it uses them, but keeps Escape", () => {
    expect(previewKeyAction("ArrowRight", true)).toBeNull();
    expect(previewKeyAction("ArrowLeft", true)).toBeNull();
    expect(previewKeyAction("Escape", true)).toEqual({ type: "exit" });
  });

  test("ignores every other key", () => {
    expect(previewKeyAction("Enter", false)).toBeNull();
    expect(previewKeyAction("a", false)).toBeNull();
  });
});
