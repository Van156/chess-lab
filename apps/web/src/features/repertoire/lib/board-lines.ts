import type { BoardArrow } from "@/shared/components/board";

import { bestMoveArrow, type SuggestionLine } from "./engine-view";
import { lineColour } from "./line-colours";
import { clampLineCount } from "./lines-preference";
import type { RepertoireMove } from "./repertoire-types";
import type { EnginePanelState } from "./suggestion-state";

/** Repertoire moves get their own colour (amber), apart from the engine's per-line colours and the mint note arrows. */
export const REPERTOIRE_ARROW_COLOR = "#f5a524";

/**
 * Opacity (hex alpha) of the engine arrow by rank, best first. Each rank has its own colour, so
 * the fade only keeps the best line the strongest; the weakest stays well readable.
 */
const RANK_ALPHA = ["", "e6", "d1", "bf", "b0"] as const;

/**
 * The engine lines that reach the board: the first `lineCount`, in the engine's order (best
 * first), each with its arrow and its rank. A line whose move cannot be drawn is left out, but the
 * others keep their rank, and so their colour; the arrows and their description are built from
 * the same list and cannot disagree.
 */
function drawnLines(
  lines: readonly SuggestionLine[],
  lineCount: number,
): { line: SuggestionLine; arrow: BoardArrow; rank: number }[] {
  return lines.slice(0, clampLineCount(lineCount)).flatMap((line, rank) => {
    const arrow = bestMoveArrow([line.firstMove.uci]);
    return arrow ? [{ line, arrow, rank }] : [];
  });
}

export type BoardLinesInput = {
  noteArrows: readonly BoardArrow[];
  /** The engine's lines for the position, best first. */
  engineLines: readonly SuggestionLine[];
  /** How many engine lines to draw, 1 to 5. */
  lineCount: number;
  /** The repertoire's moves from the current position. */
  repertoireMoves: readonly RepertoireMove[];
  showRepertoire: boolean;
};

/**
 * The board's arrows, bottom to top: the idea note's, the engine lines weakest to strongest, then
 * the repertoire moves. Every from/to pair appears once, taken from the highest layer that has
 * it, so a repertoire move always shows over an engine line on the same squares, which in turn
 * shows over a note arrow. The board keys arrows by their squares, so duplicates would clash.
 */
export function buildBoardArrows({
  noteArrows,
  engineLines,
  lineCount,
  repertoireMoves,
  showRepertoire,
}: BoardLinesInput): BoardArrow[] {
  const engine = drawnLines(engineLines, lineCount)
    .map(({ arrow, rank }) => ({
      ...arrow,
      color: `${lineColour(rank).color}${RANK_ALPHA[rank] ?? ""}`,
    }))
    .reverse();
  const repertoire = showRepertoire
    ? repertoireMoves
        .map((move) => bestMoveArrow([move.uci]))
        .filter((arrow) => arrow !== null)
        .map((arrow) => ({ ...arrow, color: REPERTOIRE_ARROW_COLOR }))
    : [];

  const taken = new Set<string>();
  return [...noteArrows, ...engine, ...repertoire]
    .reverse()
    .filter((arrow) => {
      const key = `${arrow.from}${arrow.to}`;
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    })
    .reverse();
}

/**
 * The arrows in words, so colour and opacity never carry the meaning alone. Both lists stay
 * complete when arrows collapse onto the same squares, and only engine lines that are drawn are
 * named.
 */
export function describeBoardLines(
  engineLines: readonly SuggestionLine[],
  lineCount: number,
  repertoireMoves: readonly RepertoireMove[],
  showRepertoire: boolean,
): string {
  const engine = drawnLines(engineLines, lineCount).map(
    ({ line, rank }) => `${rank + 1} ${line.firstMove.san} (${lineColour(rank).name})`,
  );
  const parts = [
    engine.length > 0 ? `Engine lines, best first: ${engine.join(", ")}.` : "",
    showRepertoire && repertoireMoves.length > 0
      ? `Repertoire moves: ${repertoireMoves.map((move) => move.san).join(", ")}.`
      : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * The board's arrows and their wording for one position. Engine lines come only from a panel that
 * has some (`analysing` or `done`); every other state draws none, so a stale or absent search never
 * reaches the board.
 */
export function boardLinesFor({
  panel,
  noteArrows,
  lineCount,
  repertoireMoves,
  showRepertoire,
}: Omit<BoardLinesInput, "engineLines"> & { panel: EnginePanelState }): {
  arrows: BoardArrow[];
  text: string;
} {
  const engineLines = panel.kind === "analysing" || panel.kind === "done" ? panel.lines : [];
  return {
    arrows: buildBoardArrows({
      noteArrows,
      engineLines,
      lineCount,
      repertoireMoves,
      showRepertoire,
    }),
    text: describeBoardLines(engineLines, lineCount, repertoireMoves, showRepertoire),
  };
}
