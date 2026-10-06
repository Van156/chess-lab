/** Display helpers shared by the Games and Mistakes screens. */

/** UTC calendar date as `YYYY-MM-DD`, so the text does not depend on the viewer's time zone. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const SIDE_LABEL = { white: "White", black: "Black" } as const;

/** "White" / "Black" for the side the user played. */
export function sideLabel(side: "white" | "black"): string {
  return SIDE_LABEL[side];
}
