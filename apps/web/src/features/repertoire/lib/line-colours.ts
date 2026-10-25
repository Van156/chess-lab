import { boardTheme } from "@/shared/components/board/board-theme";

/** One engine line's colour: a hex value for arrows and swatches, and its name for assistive technology. */
export type LineColour = { color: string; name: string };

/**
 * One colour per engine line rank, best first. The best line keeps the engine blue; the rest are
 * apart from each other and from the amber repertoire arrows and the mint idea-note arrows, and
 * read on both board squares. The name travels with the colour so the board's description and the
 * engine block can say it in words.
 */
export const LINE_COLOURS: readonly LineColour[] = [
  { color: boardTheme.engineArrow, name: "blue" },
  { color: "#b388ff", name: "violet" },
  { color: "#ff6eb4", name: "pink" },
  { color: "#b8e03c", name: "lime" },
  { color: "#ff5d5d", name: "red" },
];

const LAST = LINE_COLOURS.length - 1;

/** The colour of the engine line at `rank`, counted from 0; a rank off either end uses the nearest. */
export function lineColour(rank: number): LineColour {
  return LINE_COLOURS[Math.min(Math.max(rank, 0), LAST)] as LineColour;
}
