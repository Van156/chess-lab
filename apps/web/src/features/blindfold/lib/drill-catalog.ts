import type { DrillKind } from "./questions";

export type DrillInfo = {
  kind: DrillKind;
  label: string;
  /** One-line description of what a question asks. */
  description: string;
  /** Example question shown to set expectations. */
  example: string;
};

/** The four blindfold drills, in the order the training plan introduces them. */
export const DRILL_CATALOG: readonly DrillInfo[] = [
  {
    kind: "square_colour",
    label: "Square colour",
    description: "Say whether a square is light or dark, as fast as you can.",
    example: "Is f6 light or dark?",
  },
  {
    kind: "coordinates",
    label: "Coordinates",
    description: "A square is highlighted on an empty board without labels; type its name.",
    example: "Which square is highlighted?",
  },
  {
    kind: "diagonals",
    label: "Diagonals",
    description: "Name every square on a diagonal through a given square.",
    example: "Which squares lie on the a1-h8 diagonal through c3?",
  },
  {
    kind: "knight_distance",
    label: "Knight distance",
    description: "Count the fewest knight moves between two squares.",
    example: "Fewest knight moves from b1 to f7?",
  },
];
