import type { ReactNode } from "react";

import type { DiagramArrow } from "../../lib/guide-content";
import { piecesFromFen } from "../../lib/drills/fen";
import GuideDiagram from "../guide-diagram";

export type RevealBoardProps = {
  fen: string;
  /** Draw the pieces; false shows the empty board (geometry drills). */
  showPieces?: boolean;
  highlights?: readonly string[];
  /** Squares marked in the destructive colour, e.g. a king in check. */
  dangerHighlights?: readonly string[];
  arrows?: readonly DiagramArrow[];
  /** Accessible description of the board. */
  label: string;
  /** One or two lines under the board that say what it shows. */
  caption: ReactNode;
};

/**
 * The small board shown after answering, so the answer is seen once it has been worked out. It is
 * the same static SVG board as the guide diagrams, so every teaching board reads alike.
 */
export default function RevealBoard({
  fen,
  showPieces = true,
  highlights,
  dangerHighlights,
  arrows,
  label,
  caption,
}: RevealBoardProps) {
  const pieces = showPieces
    ? piecesFromFen(fen).map(({ colour, piece, square }) => ({
        square,
        piece: colour === "white" ? piece : piece.toLowerCase(),
      }))
    : [];
  return (
    <figure
      data-slot="reveal-board"
      className="flex w-full max-w-sm flex-col gap-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300"
    >
      <GuideDiagram
        diagram={{ highlights, dangerHighlights, arrows, pieces, caption: label }}
        showCaption={false}
      />
      <figcaption className="text-sm text-pretty text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
