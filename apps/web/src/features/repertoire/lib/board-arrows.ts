import { boardTheme, type BoardArrow } from "@/shared/components/board";

/**
 * The board's arrows: the idea note's own, then the engine's best move on top in the engine colour
 * (blue), so the two can be told apart. The engine arrow's move is also written out in the panel,
 * so the colour is never the only carrier of meaning.
 */
export function mergeBoardArrows(
  noteArrows: readonly BoardArrow[],
  engineArrow: BoardArrow | null,
): BoardArrow[] {
  return engineArrow
    ? [...noteArrows, { ...engineArrow, color: boardTheme.engineArrow }]
    : [...noteArrows];
}
