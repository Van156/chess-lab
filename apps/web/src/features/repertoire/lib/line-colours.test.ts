import { describe, expect, test } from "bun:test";

import { boardTheme } from "@/shared/components/board/board-theme";

import { REPERTOIRE_ARROW_COLOR } from "./board-lines";
import { LINE_COLOURS, lineColour } from "./line-colours";

describe("LINE_COLOURS", () => {
  test("has five distinct colours and names, one per engine line rank", () => {
    expect(LINE_COLOURS).toHaveLength(5);
    expect(new Set(LINE_COLOURS.map((entry) => entry.color)).size).toBe(5);
    expect(new Set(LINE_COLOURS.map((entry) => entry.name)).size).toBe(5);
  });

  test("keeps the best line in the engine blue and clear of the repertoire and note colours", () => {
    expect(LINE_COLOURS[0]?.color).toBe(boardTheme.engineArrow);
    const colours = LINE_COLOURS.map((entry) => entry.color);
    expect(colours).not.toContain(REPERTOIRE_ARROW_COLOR);
    expect(colours).not.toContain(boardTheme.arrow);
  });
});

describe("lineColour", () => {
  test("gives the colour of a rank, counted from 0", () => {
    expect(lineColour(0)).toBe(LINE_COLOURS[0]);
    expect(lineColour(4)).toBe(LINE_COLOURS[4]);
  });

  test("falls back to the last colour for a rank past the palette", () => {
    expect(lineColour(9)).toBe(LINE_COLOURS[4]);
    expect(lineColour(-1)).toBe(LINE_COLOURS[0]);
  });
});
