import { createFileRoute } from "@tanstack/react-router";
import { Chess, type Square } from "chess.js";
import { useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";

/**
 * Throwaway S0 spike (deleted in S12): react-chessboard v5 at 375 px with tap-tap and drag
 * moves, a promotion picker and arrows. Not listed in the lab catalog on purpose.
 */
export const Route = createFileRoute("/prototype/board-spike")({
  component: BoardSpike,
});

type PromotionPiece = "q" | "r" | "b" | "n";
const PROMOTION_PIECES: readonly PromotionPiece[] = ["q", "r", "b", "n"];
const PROMOTION_START_FEN = "8/P6k/8/8/8/8/6K1/8 w - - 0 1";
const SELECTED_STYLE = { backgroundColor: "rgba(255, 215, 0, 0.45)" };
const TARGET_STYLE = {
  background: "radial-gradient(circle, rgba(0,0,0,0.3) 22%, transparent 24%)",
};

interface PendingPromotion {
  from: Square;
  to: Square;
}

function BoardSpike() {
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [lastMove, setLastMove] = useState("none");

  const targets = selected ? game.moves({ square: selected, verbose: true }) : [];
  const arrows: Arrow[] = targets.map((m) => ({
    startSquare: m.from,
    endSquare: m.to,
    color: "rgba(0, 128, 0, 0.55)",
  }));
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) squareStyles[selected] = SELECTED_STYLE;
  for (const m of targets) squareStyles[m.to] = TARGET_STYLE;

  /** Applies a move on a copy; returns false when illegal. Promotion defaults are asked first. */
  function tryMove(from: Square, to: Square, promotion?: PromotionPiece): boolean {
    const isPromotion = game
      .moves({ square: from, verbose: true })
      .some((m) => m.to === to && m.promotion !== undefined);
    if (isPromotion && !promotion) {
      setPending({ from, to });
      return true;
    }
    const next = new Chess(game.fen());
    try {
      const move = next.move({ from, to, promotion });
      setGame(next);
      setLastMove(move.san);
      setSelected(null);
      setPending(null);
      return true;
    } catch {
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    const sq = square as Square;
    if (selected && selected !== sq && tryMove(selected, sq)) return;
    const piece = game.get(sq);
    setSelected(piece && piece.color === game.turn() ? sq : null);
  }

  function reset(fen?: string) {
    setGame(fen ? new Chess(fen) : new Chess());
    setSelected(null);
    setPending(null);
    setLastMove("none");
  }

  return (
    <main className="mx-auto flex w-[375px] max-w-full flex-col gap-3 p-2">
      <h1 className="text-lg font-semibold">react-chessboard spike (375 px)</h1>
      <div className="relative w-full touch-manipulation">
        <Chessboard
          options={{
            position: game.fen(),
            squareStyles,
            arrows,
            allowDrawingArrows: true,
            clearArrowsOnClick: false,
            onSquareClick,
            onPieceDrop: ({ sourceSquare, targetSquare }) =>
              targetSquare ? tryMove(sourceSquare as Square, targetSquare as Square) : false,
          }}
        />
        {pending && (
          <div
            role="group"
            aria-label="Choose promotion piece"
            className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center gap-2 bg-black/70 p-3"
          >
            {PROMOTION_PIECES.map((p) => (
              <button
                key={p}
                type="button"
                className="min-h-11 min-w-11 rounded bg-white px-3 text-lg font-semibold text-black"
                onClick={() => tryMove(pending.from, pending.to, p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm">
        Turn: {game.turn() === "w" ? "White" : "Black"} | Last move: {lastMove}
      </p>
      <div className="flex gap-2">
        <button type="button" className="min-h-11 rounded border px-3" onClick={() => reset()}>
          Reset
        </button>
        <button
          type="button"
          className="min-h-11 rounded border px-3"
          onClick={() => reset(PROMOTION_START_FEN)}
        >
          Promotion position
        </button>
      </div>
      <p className="text-xs opacity-70">
        Check: tap-tap and drag moves, promotion picker (a7-a8), right-drag/long-press arrows, no
        page scroll while dragging.
      </p>
    </main>
  );
}
