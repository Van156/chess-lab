import { cn } from "@b2c-template/ui/lib/utils";
import { useId } from "react";

import { sortPieces } from "../../lib/drills/fen";
import type { PieceColour, PlacedPiece } from "../../lib/drills/types";
import PieceGlyph from "./piece-glyph";
import { PIECE_NAMES } from "./pieces";

export type PieceListProps = {
  pieces: readonly PlacedPiece[];
  /** Accents that side's column (the "to move" tag itself is shown by the caller). */
  toMove?: PieceColour;
};

const SIDES: readonly { colour: PieceColour; label: string }[] = [
  { colour: "white", label: "White" },
  { colour: "black", label: "Black" },
];

/** The position as text: White and Black columns of glyph plus square, king first. */
export default function PieceList({ pieces, toMove }: PieceListProps) {
  const sorted = sortPieces(pieces);
  const id = useId();
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {SIDES.map(({ colour, label }) => {
        const side = sorted.filter((piece) => piece.colour === colour);
        const headingId = `${id}-${colour}`;
        return (
          <section
            key={colour}
            aria-labelledby={headingId}
            className={cn(
              "flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-2.5 sm:p-4",
              toMove === colour && "border-primary/40",
            )}
          >
            <h3
              id={headingId}
              className="flex items-center justify-between gap-2 text-sm font-medium"
            >
              <span>
                {label}
                <span className="sr-only">
                  , {side.length} {side.length === 1 ? "piece" : "pieces"}
                  {toMove === colour ? ", to move" : ""}
                </span>
              </span>
              <span aria-hidden className="text-xs font-normal text-muted-foreground tabular-nums">
                {side.length}
              </span>
            </h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-1.5">
              {side.map((piece) => (
                <li
                  key={piece.square}
                  className="flex h-10 items-center gap-1 rounded-lg bg-muted/70 px-1.5 sm:gap-1.5 sm:px-2"
                >
                  <PieceGlyph colour={piece.colour} piece={piece.piece} className="text-lg" />
                  <span className="sr-only">{PIECE_NAMES[piece.piece]} on </span>
                  <span className="font-mono text-[0.95rem] leading-none">{piece.square}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
