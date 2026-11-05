import type { ReactNode } from "react";

import { ChessBoard, type BoardArrow } from "@/shared/components/board";

export type RevealBoardProps = {
  fen: string;
  /** Draw the pieces; false shows the empty board (geometry drills). */
  showPieces?: boolean;
  highlights?: readonly string[];
  arrows?: readonly BoardArrow[];
  lastMove?: { from: string; to: string };
  /** Accessible description of the board. */
  label: string;
  /** One or two lines under the board that say what it shows. */
  caption: ReactNode;
};

/** The small board shown after answering, so the answer is seen once it has been worked out. */
export default function RevealBoard({
  fen,
  showPieces = true,
  highlights,
  arrows,
  lastMove,
  label,
  caption,
}: RevealBoardProps) {
  return (
    <figure
      data-slot="reveal-board"
      className="flex w-full max-w-sm flex-col gap-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300"
    >
      <div className="overflow-hidden rounded-xl ring-1 ring-border">
        <ChessBoard
          fen={fen}
          orientation="white"
          hidden={!showPieces}
          coordinates
          highlights={highlights}
          arrows={arrows}
          lastMove={lastMove}
          label={label}
        />
      </div>
      <figcaption className="text-sm text-pretty text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
