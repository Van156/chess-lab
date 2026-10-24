import { describe, expect, test } from "bun:test";

import { boardTheme } from "@/shared/components/board/board-theme";

import { mergeBoardArrows } from "./board-arrows";

const noteArrows = [
  { from: "g1", to: "f3" },
  { from: "f1", to: "c4" },
];

describe("mergeBoardArrows", () => {
  test("keeps the idea-note arrows as they are without an engine arrow", () => {
    expect(mergeBoardArrows(noteArrows, null)).toEqual(noteArrows);
  });

  test("returns no arrows for an empty note and no engine arrow", () => {
    expect(mergeBoardArrows([], null)).toEqual([]);
  });

  test("draws the engine arrow last, in the engine colour", () => {
    const merged = mergeBoardArrows(noteArrows, { from: "e2", to: "e4" });
    expect(merged).toEqual([
      ...noteArrows,
      { from: "e2", to: "e4", color: boardTheme.engineArrow },
    ]);
  });

  test("uses a colour different from the idea-note arrow colour", () => {
    expect(boardTheme.engineArrow).not.toBe(boardTheme.arrow);
  });

  test("overrides a colour the engine arrow came with", () => {
    const [arrow] = mergeBoardArrows([], { from: "e2", to: "e4", color: "red" });
    expect(arrow?.color).toBe(boardTheme.engineArrow);
  });

  test("does not change the note arrows it was given", () => {
    const input = [...noteArrows];
    mergeBoardArrows(input, { from: "e2", to: "e4" });
    expect(input).toEqual(noteArrows);
  });
});
