import { cn } from "@b2c-template/ui/lib/utils";

import type { PieceColour, PieceLetter } from "../../lib/drills/types";
import { PIECE_GLYPHS } from "./pieces";

const GLYPH_FONT =
  "[font-family:'DejaVu_Sans','Segoe_UI_Symbol','Apple_Symbols','Noto_Sans_Symbols_2',sans-serif]";

/**
 * A chess piece drawn from its solid Unicode glyph on a tiny board square: White on a dark square,
 * Black on a light one, as the reveal boards draw them. Decorative: callers name the piece.
 */
export default function PieceGlyph({
  colour,
  piece,
  className,
}: {
  colour: PieceColour;
  piece: PieceLetter;
  /** Sizes the tile; the glyph follows the font size. */
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-piece-glyph={`${colour}-${piece}`}
      className={cn(
        "inline-flex size-[1.4em] shrink-0 items-center justify-center rounded-[0.3em] leading-none select-none",
        colour === "white" ? "bg-[#3d5278] text-[#f4f7fc]" : "bg-[#8fa3c4] text-[#0b1220]",
        className,
      )}
    >
      <span className={cn("translate-y-[0.03em] text-[1.05em]", GLYPH_FONT)}>
        {PIECE_GLYPHS[piece]}
      </span>
    </span>
  );
}
