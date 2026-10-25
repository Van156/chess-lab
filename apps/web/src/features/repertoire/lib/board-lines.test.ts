import { describe, expect, test } from "bun:test";

import { boardTheme } from "@/shared/components/board/board-theme";

import {
  REPERTOIRE_ARROW_COLOR,
  boardLinesFor,
  buildBoardArrows,
  describeBoardLines,
} from "./board-lines";
import type { SuggestionLine } from "./engine-view";
import { LINE_COLOURS } from "./line-colours";
import type { EnginePanelState } from "./suggestion-state";
import type { RepertoireMove } from "./repertoire-types";

const engineLine = (multipv: number, san: string, uci: string): SuggestionLine => ({
  multipv,
  depth: 18,
  white: { kind: "cp", cp: 0 },
  scoreText: "0.00",
  scoreLabel: "Even position",
  firstMove: { san, uci },
  moveText: san,
  inRepertoire: false,
});

const lines = [
  engineLine(1, "e4", "e2e4"),
  engineLine(2, "d4", "d2d4"),
  engineLine(3, "Nf3", "g1f3"),
  engineLine(4, "c4", "c2c4"),
  engineLine(5, "g3", "g2g3"),
];

const repertoireMove = (san: string, uci: string): RepertoireMove => ({
  id: `id-${san}`,
  fromPositionId: "start",
  toPositionId: `to-${san}`,
  san,
  uci,
  isUserMove: true,
});

const input = (overrides: Partial<Parameters<typeof buildBoardArrows>[0]> = {}) => ({
  noteArrows: [],
  engineLines: lines,
  lineCount: 3,
  repertoireMoves: [],
  showRepertoire: true,
  ...overrides,
});

const keys = (arrows: { from: string; to: string }[]) => arrows.map((a) => `${a.from}${a.to}`);

describe("buildBoardArrows", () => {
  test("draws as many engine lines as the count, weakest first so the best is on top", () => {
    const arrows = buildBoardArrows(input({ lineCount: 3 }));
    expect(keys(arrows)).toEqual(["g1f3", "d2d4", "e2e4"]);
  });

  test("each line has its own colour: the best in the engine blue, the rest fading with rank", () => {
    const [third, second, best] = buildBoardArrows(input({ lineCount: 3 }));
    expect(best?.color).toBe(LINE_COLOURS[0]?.color);
    expect(second?.color).toStartWith(LINE_COLOURS[1]?.color ?? "");
    expect(third?.color).toStartWith(LINE_COLOURS[2]?.color ?? "");
    expect(new Set([best?.color, second?.color, third?.color]).size).toBe(3);
  });

  test("five lines give five distinct colours", () => {
    const arrows = buildBoardArrows(input({ lineCount: 5 }));
    expect(arrows).toHaveLength(5);
    expect(new Set(arrows.map((arrow) => arrow.color?.slice(0, 7))).size).toBe(5);
  });

  test("a line keeps its rank colour when an earlier line cannot be drawn", () => {
    const broken = [engineLine(1, "??", "zz"), engineLine(2, "d4", "d2d4")];
    const [arrow] = buildBoardArrows(input({ engineLines: broken, lineCount: 2 }));
    expect(arrow?.color).toStartWith(LINE_COLOURS[1]?.color ?? "");
  });

  test("a count of one draws only the best line, exactly as the single-arrow board did", () => {
    expect(buildBoardArrows(input({ lineCount: 1 }))).toEqual([
      { from: "e2", to: "e4", color: boardTheme.engineArrow },
    ]);
  });

  test("clamps the count: 0 draws one line, 6 and NaN follow the 1 to 5 range", () => {
    expect(buildBoardArrows(input({ lineCount: 0 }))).toHaveLength(1);
    expect(buildBoardArrows(input({ lineCount: 6 }))).toHaveLength(5);
    expect(buildBoardArrows(input({ lineCount: NaN }))).toHaveLength(3);
  });

  test("draws fewer arrows when the engine has not found that many lines yet", () => {
    expect(buildBoardArrows(input({ engineLines: lines.slice(0, 2), lineCount: 5 }))).toHaveLength(
      2,
    );
    expect(buildBoardArrows(input({ engineLines: [] }))).toEqual([]);
  });

  test("keeps the idea-note arrows underneath", () => {
    const note = { from: "a2", to: "a4" };
    const arrows = buildBoardArrows(input({ noteArrows: [note], lineCount: 1 }));
    expect(arrows[0]).toEqual(note);
    expect(arrows).toHaveLength(2);
  });

  test("draws repertoire moves in their own colour above the engine lines", () => {
    const arrows = buildBoardArrows(
      input({ lineCount: 2, repertoireMoves: [repertoireMove("c4", "c2c4")] }),
    );
    expect(keys(arrows)).toEqual(["d2d4", "e2e4", "c2c4"]);
    expect(arrows.at(-1)?.color).toBe(REPERTOIRE_ARROW_COLOR);
    expect(REPERTOIRE_ARROW_COLOR).not.toBe(boardTheme.engineArrow);
    expect(REPERTOIRE_ARROW_COLOR).not.toBe(boardTheme.arrow);
  });

  test("draws no repertoire arrows when the toggle is off", () => {
    const arrows = buildBoardArrows(
      input({
        lineCount: 1,
        showRepertoire: false,
        repertoireMoves: [repertoireMove("d4", "d2d4")],
      }),
    );
    expect(keys(arrows)).toEqual(["e2e4"]);
  });

  test("a repertoire move on the same squares as an engine line replaces it, on top", () => {
    const arrows = buildBoardArrows(
      input({ lineCount: 3, repertoireMoves: [repertoireMove("d4", "d2d4")] }),
    );
    expect(keys(arrows)).toEqual(["g1f3", "e2e4", "d2d4"]);
    expect(arrows.at(-1)?.color).toBe(REPERTOIRE_ARROW_COLOR);
  });

  test("two engine lines on the same squares collapse into the stronger one", () => {
    const duplicated = [engineLine(1, "e4", "e2e4"), engineLine(2, "e4", "e2e4")];
    const arrows = buildBoardArrows(input({ engineLines: duplicated, lineCount: 2 }));
    expect(arrows).toEqual([{ from: "e2", to: "e4", color: boardTheme.engineArrow }]);
  });

  test("promotions to different pieces share squares and collapse too", () => {
    const arrows = buildBoardArrows(
      input({
        engineLines: [],
        repertoireMoves: [repertoireMove("e8=Q", "e7e8q"), repertoireMove("e8=N", "e7e8n")],
      }),
    );
    expect(keys(arrows)).toEqual(["e7e8"]);
  });

  test("an engine or repertoire arrow replaces an idea-note arrow on the same squares", () => {
    const arrows = buildBoardArrows(
      input({ noteArrows: [{ from: "e2", to: "e4" }], lineCount: 1 }),
    );
    expect(arrows).toEqual([{ from: "e2", to: "e4", color: boardTheme.engineArrow }]);
  });

  test("never repeats a from/to pair", () => {
    const arrows = buildBoardArrows(
      input({
        lineCount: 5,
        noteArrows: [{ from: "g1", to: "f3" }],
        repertoireMoves: [repertoireMove("e4", "e2e4"), repertoireMove("Nf3", "g1f3")],
      }),
    );
    expect(new Set(keys(arrows)).size).toBe(arrows.length);
  });

  test("ignores a malformed line", () => {
    const broken = [engineLine(1, "??", "zz"), engineLine(2, "d4", "d2d4")];
    expect(keys(buildBoardArrows(input({ engineLines: broken })))).toEqual(["d2d4"]);
  });

  test("does not change the inputs", () => {
    const given = [...lines];
    buildBoardArrows(input({ engineLines: given, lineCount: 2 }));
    expect(given).toEqual(lines);
  });
});

describe("describeBoardLines", () => {
  test("lists the engine lines, best first, and the repertoire moves", () => {
    const text = describeBoardLines(lines, 3, [repertoireMove("c4", "c2c4")], true);
    expect(text).toBe(
      "Engine lines, best first: 1 e4 (blue), 2 d4 (violet), 3 Nf3 (pink). Repertoire moves: c4.",
    );
  });

  test("stays complete when arrows collapse onto the same squares", () => {
    const text = describeBoardLines(lines, 2, [repertoireMove("e4", "e2e4")], true);
    expect(text).toContain("1 e4 (blue), 2 d4 (violet)");
    expect(text).toContain("Repertoire moves: e4.");
  });

  test("leaves out the repertoire moves when the toggle is off", () => {
    const text = describeBoardLines(lines, 1, [repertoireMove("c4", "c2c4")], false);
    expect(text).toBe("Engine lines, best first: 1 e4 (blue).");
  });

  test("says nothing about a list that is empty, and nothing at all when both are", () => {
    expect(describeBoardLines([], 3, [repertoireMove("c4", "c2c4")], true)).toBe(
      "Repertoire moves: c4.",
    );
    expect(describeBoardLines(lines, 1, [], true)).toBe("Engine lines, best first: 1 e4 (blue).");
    expect(describeBoardLines([], 3, [], true)).toBe("");
  });

  test("follows the clamped count", () => {
    expect(describeBoardLines(lines, 9, [], true)).toContain("g3");
    expect(describeBoardLines(lines, 0, [], true)).toBe("Engine lines, best first: 1 e4 (blue).");
  });
});

describe("describeBoardLines and buildBoardArrows agree", () => {
  test("names no engine line whose move cannot be drawn", () => {
    const broken = [engineLine(1, "??", "zz"), engineLine(2, "d4", "d2d4")];
    expect(describeBoardLines(broken, 3, [], true)).toBe(
      "Engine lines, best first: 2 d4 (violet).",
    );
    expect(keys(buildBoardArrows(input({ engineLines: broken })))).toEqual(["d2d4"]);
  });

  test("says nothing when no engine line can be drawn", () => {
    expect(describeBoardLines([engineLine(1, "??", "(none)")], 3, [], true)).toBe("");
  });
});

describe("boardLinesFor", () => {
  const done = (shown: SuggestionLine[]): EnginePanelState => ({
    kind: "done",
    depth: 18,
    maxDepth: 18,
    lines: shown,
  });
  const base = {
    noteArrows: [],
    lineCount: 2,
    repertoireMoves: [repertoireMove("c4", "c2c4")],
    showRepertoire: true,
  };

  test("draws and describes the engine lines of a finished search", () => {
    const out = boardLinesFor({ ...base, panel: done(lines) });
    expect(keys(out.arrows)).toEqual(["d2d4", "e2e4", "c2c4"]);
    expect(out.text).toBe(
      "Engine lines, best first: 1 e4 (blue), 2 d4 (violet). Repertoire moves: c4.",
    );
  });

  test("uses the lines found so far while the search is analysing", () => {
    const panel: EnginePanelState = {
      kind: "analysing",
      depth: 6,
      maxDepth: 18,
      lines: lines.slice(0, 1),
    };
    const out = boardLinesFor({ ...base, panel });
    expect(keys(out.arrows)).toEqual(["e2e4", "c2c4"]);
    expect(out.text).toBe("Engine lines, best first: 1 e4 (blue). Repertoire moves: c4.");
  });

  test.each<EnginePanelState>([
    { kind: "off" },
    { kind: "starting" },
    { kind: "unavailable" },
    { kind: "terminal" },
  ])("draws no engine line when the panel is %p", (panel) => {
    const out = boardLinesFor({ ...base, panel });
    expect(keys(out.arrows)).toEqual(["c2c4"]);
    expect(out.text).toBe("Repertoire moves: c4.");
  });

  test("keeps the note arrows and honours the repertoire toggle", () => {
    const out = boardLinesFor({
      ...base,
      panel: { kind: "off" },
      noteArrows: [{ from: "a2", to: "a4" }],
      showRepertoire: false,
    });
    expect(keys(out.arrows)).toEqual(["a2a4"]);
    expect(out.text).toBe("");
  });
});
