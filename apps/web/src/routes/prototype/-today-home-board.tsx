import { cn } from "@b2c-template/ui/lib/utils";

import { boardLabel, boardSquares } from "./-today-home-mock-data";

export interface BoardTheme {
  light: string;
  dark: string;
  /** Overlay colour for the last-move squares (use an alpha colour). */
  lastMove: string;
  whitePiece: string;
  blackPiece: string;
}

const OUTLINE = "-1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111, 1px 1px 0 #111, 0 0 3px #111";
const HALO = "0 0 2px rgba(255,255,255,.45)";

interface BoardProps {
  theme: BoardTheme;
  className?: string;
}

/** Shared 8x8 board for the Today prototype. Colours come from the variant; layout does not. */
export function Board({ theme, className }: BoardProps) {
  return (
    <div
      role="img"
      aria-label={boardLabel}
      className={cn("@container aspect-square w-full overflow-hidden", className)}
    >
      <div className="grid size-full grid-cols-8 grid-rows-8">
        {boardSquares.map((square) => (
          <div
            key={square.name}
            className="flex items-center justify-center leading-none select-none"
            style={{
              backgroundColor: square.light ? theme.light : theme.dark,
              backgroundImage: square.lastMove
                ? `linear-gradient(${theme.lastMove}, ${theme.lastMove})`
                : undefined,
              color: square.color === "w" ? theme.whitePiece : theme.blackPiece,
              textShadow: square.color === "w" ? OUTLINE : HALO,
              fontSize: "10cqw",
            }}
          >
            {square.glyph}
          </div>
        ))}
      </div>
    </div>
  );
}
