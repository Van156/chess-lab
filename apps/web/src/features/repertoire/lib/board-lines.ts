import { boardTheme, type BoardArrow } from "@/shared/components/board";

import { bestMoveArrow, type SuggestionLine } from "./engine-view";
import { clampLineCount } from "./lines-preference";
import type { RepertoireMove } from "./repertoire-types";

/** Repertoire moves get their own colour (amber), apart from the blue engine and mint note arrows. */
export const REPERTOIRE_ARROW_COLOR = "#f5a524";

/**
 * Opacity (hex alpha) of the engine arrow by rank, best first. The board takes a colour, not a
 * width, so strength is carried by opacity; the best line keeps the plain engine colour.
 */
const RANK_ALPHA = ["", "bf", "8c", "66", "4d"] as const;

/** The first `lineCount` engine lines, in the engine's order (best first). */
function shownLines(lines: readonly SuggestionLine[], lineCount: number): SuggestionLine[] {
  return lines.slice(0, clampLineCount(lineCount));
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
  const engine = shownLines(engineLines, lineCount)
    .map((line) => bestMoveArrow([line.firstMove.uci]))
    .filter((arrow) => arrow !== null)
    .map((arrow, rank) => ({
      ...arrow,
      color: `${boardTheme.engineArrow}${RANK_ALPHA[rank] ?? ""}`,
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
 * complete when arrows collapse onto the same squares.
 */
export function describeBoardLines(
  engineLines: readonly SuggestionLine[],
  lineCount: number,
  repertoireMoves: readonly RepertoireMove[],
  showRepertoire: boolean,
): string {
  const engine = shownLines(engineLines, lineCount).map((line) => line.firstMove.san);
  const parts = [
    engine.length > 0 ? `Engine lines, best first: ${engine.join(", ")}.` : "",
    showRepertoire && repertoireMoves.length > 0
      ? `Repertoire moves: ${repertoireMoves.map((move) => move.san).join(", ")}.`
      : "",
  ];
  return parts.filter(Boolean).join(" ");
}
