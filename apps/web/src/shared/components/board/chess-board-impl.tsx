import { legalMoves, parseMove } from "@b2c-template/chess";
import { Button } from "@b2c-template/ui/components/button";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useState, type CSSProperties } from "react";

import { boardTheme } from "./board-theme";
import type { BoardProps, PromotionPiece } from "./board-types";

/**
 * react-chessboard v5 adapter. This is the only file that knows the library, so a swap to
 * cm-chessboard (S0.6 verdict pending) stays local to it.
 */

/**
 * Blindfold: the library gets an empty position, so no piece is drawn or focusable. Legal
 * moves still come from the real `fen` through `@b2c-template/chess`, so play stays active.
 * (Design sketched empty piece renderers; those still leave one focusable wrapper per piece.)
 */
const NO_PIECES = {} as const;

const PROMOTION_CHOICES: readonly { piece: PromotionPiece; name: string; glyph: string }[] = [
  { piece: "q", name: "queen", glyph: "Q" },
  { piece: "r", name: "rook", glyph: "R" },
  { piece: "b", name: "bishop", glyph: "B" },
  { piece: "n", name: "knight", glyph: "N" },
];

const SELECTED_STYLE: CSSProperties = { backgroundColor: "var(--board-highlight)" };
const LAST_MOVE_STYLE: CSSProperties = { backgroundColor: "var(--board-last-move)" };
const TARGET_STYLE: CSSProperties = {
  background: "radial-gradient(circle, rgba(0,0,0,0.3) 22%, transparent 24%)",
};

type Pending = { from: string; to: string };

export function PromotionPicker({
  onPick,
  onCancel,
}: {
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Choose promotion piece"
      className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-wrap items-center justify-center gap-2 bg-black/70 p-3"
    >
      {PROMOTION_CHOICES.map(({ piece, name, glyph }) => (
        <Button
          key={piece}
          type="button"
          variant="secondary"
          className="min-h-11 min-w-11 text-lg"
          aria-label={`Promote to ${name}`}
          onClick={() => onPick(piece)}
        >
          {glyph}
        </Button>
      ))}
      <Button type="button" variant="outline" className="min-h-11 min-w-11" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export default function ChessBoardImpl({
  fen,
  orientation,
  onMove,
  arrows = [],
  highlights = [],
  lastMove,
  hidden = false,
}: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const legal = legalMoves(fen);
  const targets = selected
    ? legal.filter((move) => move.uci.startsWith(selected)).map((move) => move.uci.slice(2, 4))
    : [];

  /** Resolves a user move against the legal list; false means rejected, nothing is reported. */
  function attempt(from: string, to: string, promotion?: PromotionPiece): boolean {
    if (!onMove) return false;
    const candidates = legal.filter((move) => move.uci.startsWith(`${from}${to}`));
    if (candidates.length === 0) return false;
    const needsPromotion = candidates.every((move) => move.uci.length === 5);
    if (needsPromotion && !promotion) {
      setSelected(null);
      setPending({ from, to });
      return false;
    }
    const parsed = parseMove(fen, `${from}${to}${promotion ?? ""}`);
    if (!parsed) return false;
    setSelected(null);
    setPending(null);
    return onMove({ from, to, ...(promotion ? { promotion } : {}), san: parsed.san });
  }

  function handleSquareClick({ square }: { square: string }) {
    if (!onMove || pending) return;
    if (selected && selected !== square && attempt(selected, square)) return;
    if (selected && targets.includes(square)) return; // promotion picker opened
    const canMove = legal.some((move) => move.uci.startsWith(square));
    setSelected(canMove && square !== selected ? square : null);
  }

  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE_STYLE;
    squareStyles[lastMove.to] = LAST_MOVE_STYLE;
  }
  for (const square of highlights) squareStyles[square] = SELECTED_STYLE;
  for (const square of targets) squareStyles[square] = { ...squareStyles[square], ...TARGET_STYLE };
  if (selected) squareStyles[selected] = SELECTED_STYLE;

  const options: ChessboardOptions = {
    position: hidden ? NO_PIECES : fen,
    boardOrientation: orientation,
    allowDragging: Boolean(onMove) && !hidden && !pending,
    allowDrawingArrows: false,
    showAnimations: true,
    lightSquareStyle: { backgroundColor: "var(--board-light)" },
    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
    squareStyles,
    arrows: arrows.map((arrow) => ({
      startSquare: arrow.from,
      endSquare: arrow.to,
      color: arrow.color ?? boardTheme.arrow,
    })),
    onSquareClick: handleSquareClick,
    onPieceDrop: ({ sourceSquare, targetSquare }) =>
      targetSquare ? attempt(sourceSquare, targetSquare) : false,
  };

  return (
    <div className="relative w-full">
      <Chessboard options={options} />
      {pending && (
        <PromotionPicker
          onPick={(piece) => attempt(pending.from, pending.to, piece)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
