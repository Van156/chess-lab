import { cn } from "@b2c-template/ui/lib/utils";
import { useId } from "react";

import { boardLabel, boardSquares, type BoardSquare } from "./-today-home-mock-data";

export interface BoardTheme {
  light: string;
  dark: string;
  /** Overlay colour for the last-move squares (use an alpha colour). */
  lastMove: string;
  whitePiece: string;
  blackPiece: string;
  /** Overlay colour for highlighted squares. Falls back to `lastMove`. */
  highlight?: string;
  /** Stroke colour for arrows. Falls back to a mint accent. */
  arrow?: string;
}

/** An arrow between two algebraic squares, drawn with White at the bottom. */
export interface BoardArrow {
  from: string;
  to: string;
  /** Overrides the theme arrow colour, e.g. to tell the played move from the best one. */
  color?: string;
}

const OUTLINE = "-1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111, 1px 1px 0 #111, 0 0 3px #111";
const HALO = "0 0 2px rgba(255,255,255,.45)";

interface BoardProps {
  theme: BoardTheme;
  className?: string;
  /** Position to draw. Defaults to the Today prototype position. */
  squares?: readonly BoardSquare[];
  /** Accessible description. Defaults to the Today prototype description. */
  label?: string;
  /** Squares to tint with `theme.highlight`. */
  highlights?: readonly string[];
  arrows?: readonly BoardArrow[];
  /** Draws the empty grid without pieces (blindfold mode). */
  hidden?: boolean;
}

function center(square: string) {
  return { x: "abcdefgh".indexOf(square[0]) + 0.5, y: 8 - Number(square[1]) + 0.5 };
}

/** Shared 8x8 board for the prototypes. Colours come from the variant; layout does not. */
export function Board({
  theme,
  className,
  squares = boardSquares,
  label = boardLabel,
  highlights = [],
  arrows = [],
  hidden = false,
}: BoardProps) {
  const markerId = useId();
  const arrowColor = theme.arrow ?? "#3ee6b0";
  const highlightColor = theme.highlight ?? theme.lastMove;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("@container relative aspect-square w-full overflow-hidden", className)}
    >
      <div className="grid size-full grid-cols-8 grid-rows-8">
        {squares.map((square) => {
          const tint = highlights.includes(square.name)
            ? highlightColor
            : square.lastMove && !hidden
              ? theme.lastMove
              : undefined;
          return (
            <div
              key={square.name}
              className="flex items-center justify-center leading-none select-none"
              style={{
                backgroundColor: square.light ? theme.light : theme.dark,
                backgroundImage: tint ? `linear-gradient(${tint}, ${tint})` : undefined,
                color: square.color === "w" ? theme.whitePiece : theme.blackPiece,
                textShadow: square.color === "w" ? OUTLINE : HALO,
                fontSize: "10cqw",
              }}
            >
              {hidden ? null : square.glyph}
            </div>
          );
        })}
      </div>
      {arrows.length > 0 && !hidden && (
        <svg
          viewBox="0 0 8 8"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            {arrows.map((arrow, index) => (
              <marker
                key={`${arrow.from}${arrow.to}`}
                id={`${markerId}-${index}`}
                viewBox="0 0 4 4"
                refX="2.4"
                refY="2"
                markerWidth="2.4"
                markerHeight="2.4"
                orient="auto"
              >
                <path d="M0 0 L4 2 L0 4 Z" fill={arrow.color ?? arrowColor} />
              </marker>
            ))}
          </defs>
          {arrows.map((arrow, index) => {
            const from = center(arrow.from);
            const to = center(arrow.to);
            return (
              <line
                key={`${arrow.from}${arrow.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={arrow.color ?? arrowColor}
                strokeWidth="0.18"
                strokeLinecap="round"
                opacity="0.9"
                markerEnd={`url(#${markerId}-${index})`}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
