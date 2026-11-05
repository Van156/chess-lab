import type { DrillKind } from "./questions";

/** Drills are grouped by the skill they build, in the order the training plan introduces them. */
export type DrillCategory = "geometry" | "vision" | "memory";

export type DrillCategoryInfo = { id: DrillCategory; label: string; description: string };

export const DRILL_CATEGORIES: readonly DrillCategoryInfo[] = [
  {
    id: "geometry",
    label: "Board geometry",
    description: "Know every square by name and colour without looking.",
  },
  {
    id: "vision",
    label: "Piece vision",
    description: "See how pieces move and attack on a board you cannot see.",
  },
  {
    id: "memory",
    label: "Position memory",
    description: "Hold a whole position in your head and calculate from it.",
  },
];

export type DrillInfo = {
  kind: DrillKind;
  label: string;
  category: DrillCategory;
  /** One-line description of what a question asks. */
  description: string;
  /** Example question shown to set expectations. */
  example: string;
};

/** Every blindfold drill, in the order the training plan introduces them. */
export const DRILL_CATALOG: readonly DrillInfo[] = [
  {
    kind: "square_colour",
    label: "Square colour",
    category: "geometry",
    description: "Say whether a square is light or dark, as fast as you can.",
    example: "Is f6 light or dark?",
  },
  {
    kind: "coordinates",
    label: "Coordinates",
    category: "geometry",
    description: "A square is highlighted on an empty board without labels; type its name.",
    example: "Which square is highlighted?",
  },
  {
    kind: "diagonals",
    label: "Diagonals",
    category: "geometry",
    description: "Name every square on a diagonal through a given square.",
    example: "Which squares lie on the a1-h8 diagonal through c3?",
  },
  {
    kind: "same_diagonal",
    label: "Shared diagonal",
    category: "geometry",
    description: "Decide whether two squares sit on the same diagonal, the way a bishop sees them.",
    example: "Are b2 and g7 on the same diagonal?",
  },
  {
    kind: "knight_distance",
    label: "Knight distance",
    category: "vision",
    description: "Count the fewest knight moves between two squares.",
    example: "Fewest knight moves from b1 to f7?",
  },
  {
    kind: "check_detection",
    label: "Check spotter",
    category: "vision",
    description: "Read a piece list and say whether the king is in check.",
    example: "White: Ke1. Black: Ke8, Bb4. Is the white king in check?",
  },
  {
    kind: "position_recall",
    label: "Move memory",
    category: "memory",
    description: "Follow an opening from its moves alone, then name what stands on a square.",
    example: "1.e4 e5 2.Nf3 Nc6 3.Bb5. What stands on b5?",
  },
  {
    kind: "mate_in_one",
    label: "Mate in one",
    category: "memory",
    description: "Build the position from a piece list and type the mating move.",
    example: "White: Kg1, Ra1. Black: Kg8, f7, g7, h7. White to move.",
  },
];
