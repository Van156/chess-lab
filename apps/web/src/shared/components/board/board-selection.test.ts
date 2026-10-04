import { describe, expect, test } from "bun:test";
import { legalMoves } from "@b2c-template/chess";

import { emptySelection, resolveMove, selectionFor, tap, type Selection } from "./board-selection";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const PROMO = "7k/P7/8/8/8/8/8/K7 w - - 0 1";

const ucis = (fen: string) => legalMoves(fen).map((move) => move.uci);

describe("tap-tap move", () => {
  test("first tap selects an own piece, second tap on a target asks for the move", () => {
    const legal = ucis(START);
    const first = tap(emptySelection(START), "e2", legal);
    expect(first.selection.selected).toBe("e2");
    expect(first.attempt).toBeUndefined();
    const second = tap(first.selection, "e4", legal);
    expect(second.attempt).toEqual({ from: "e2", to: "e4" });
  });

  test("tapping the selected square again deselects it", () => {
    const legal = ucis(START);
    const selected = tap(emptySelection(START), "e2", legal).selection;
    expect(tap(selected, "e2", legal).selection.selected).toBeNull();
  });

  test("tapping another own piece moves the selection; an empty square clears it", () => {
    const legal = ucis(START);
    const selected = tap(emptySelection(START), "e2", legal).selection;
    expect(tap(selected, "g1", legal).selection.selected).toBe("g1");
    expect(tap(selected, "e5", legal).selection.selected).toBeNull();
  });

  test("a square without legal moves is not selectable", () => {
    expect(tap(emptySelection(START), "e1", ucis(START)).selection.selected).toBeNull();
  });
});

describe("promotion", () => {
  test("a pawn reaching the last rank needs a piece choice before it becomes a move", () => {
    expect(resolveMove(ucis(PROMO), "a7", "a8")).toEqual({ kind: "promotion" });
    expect(resolveMove(ucis(PROMO), "a7", "a8", "n")).toEqual({ kind: "move", uci: "a7a8n" });
  });

  test("taps are ignored while a promotion is pending", () => {
    const pending: Selection = { fen: PROMO, selected: null, pending: { from: "a7", to: "a8" } };
    const result = tap(pending, "a1", ucis(PROMO));
    expect(result.selection).toBe(pending);
    expect(result.attempt).toBeUndefined();
  });
});

describe("rejection and blindfold", () => {
  test("an illegal destination is not a move", () => {
    expect(resolveMove(ucis(START), "e2", "e5")).toEqual({ kind: "illegal" });
  });

  test("a non-promotion move never asks for a piece", () => {
    expect(resolveMove(ucis(START), "e2", "e4")).toEqual({ kind: "move", uci: "e2e4" });
  });

  test("selection logic depends only on the real fen, so blindfold play stays active", () => {
    // The board hides pieces by swapping the library position; legal moves come from the fen.
    const legal = ucis(START);
    expect(tap(emptySelection(START), "e2", legal).selection.selected).toBe("e2");
  });
});

describe("reset on fen change", () => {
  test("a selection made on another position is dropped", () => {
    const selected = tap(emptySelection(START), "e2", ucis(START)).selection;
    expect(selectionFor(selected, START).selected).toBe("e2");
    expect(selectionFor(selected, AFTER_E4)).toEqual(emptySelection(AFTER_E4));
  });

  test("a pending promotion made on another position is dropped", () => {
    const pending: Selection = { fen: PROMO, selected: null, pending: { from: "a7", to: "a8" } };
    expect(selectionFor(pending, START).pending).toBeNull();
  });
});
