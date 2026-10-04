export type PromotionPiece = "q" | "r" | "b" | "n";

export type BoardMove = {
  from: string;
  to: string;
  promotion?: PromotionPiece;
  san: string;
};

export type BoardArrow = {
  from: string;
  to: string;
  /** Any CSS colour; defaults to the theme arrow colour. */
  color?: string;
};

export type BoardProps = {
  fen: string;
  orientation: "white" | "black";
  /** Called with a legal move only; return false to reject it (the piece returns to its square). */
  onMove?: (move: BoardMove) => boolean;
  arrows?: readonly BoardArrow[];
  highlights?: readonly string[];
  lastMove?: { from: string; to: string };
  /** Blindfold: no pieces are drawn, position and legal-move logic stay active. */
  hidden?: boolean;
  /** Accessible description of the position. */
  label: string;
};
