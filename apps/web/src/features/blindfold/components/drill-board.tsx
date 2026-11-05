import { cn } from "@b2c-template/ui/lib/utils";
import { useId } from "react";

import { boardTheme } from "@/shared/components/board";

import { parseSquare, type Square } from "../lib/squares";

/**
 * What a square shows: `target` is the square asked about (amber), `expected` a square of the
 * right answer (mint), `missed` one of those the player left out (mint outline), `wrong` a square
 * the player named that is not part of it (red, crossed).
 */
export type SquareMark = "target" | "expected" | "missed" | "wrong";

export type DrillBoardProps = {
  /** Accessible description of what the board shows. */
  label: string;
  marks?: Readonly<Partial<Record<Square, SquareMark>>>;
  /** Text drawn on a square, such as its name or a step number. */
  labels?: Readonly<Partial<Record<Square, string>>>;
  /** Knight hops drawn as L-shaped arrows, in order. */
  knightHops?: readonly (readonly [Square, Square])[];
  /** File letters and rank numbers along the edges. Defaults to true. */
  coordinates?: boolean;
  className?: string;
};

const CELL = 10;
const MARK_FILL: Record<SquareMark, string> = {
  target: boardTheme.highlight,
  expected: "rgba(62,230,176,.55)",
  missed: "rgba(62,230,176,.16)",
  wrong: "rgba(255,107,107,.38)",
};
const WRONG_STROKE = "#ff8a8a";
const INK_ON_LIGHT = "#1b2740";
const INK_ON_DARK = "#e6edf7";

/** Top-left corner of a square in board units, White at the bottom. */
function origin(square: Square): { x: number; y: number; light: boolean } {
  const coordinates = parseSquare(square);
  if (!coordinates) throw new Error(`Invalid square: ${square}`);
  return {
    x: coordinates.file * CELL,
    y: (7 - coordinates.rank) * CELL,
    light: (coordinates.file + coordinates.rank) % 2 === 1,
  };
}

function centre(square: Square): { x: number; y: number } {
  const { x, y } = origin(square);
  return { x: x + CELL / 2, y: y + CELL / 2 };
}

/** The L of a knight hop: two squares along the long leg, then one across. */
function hopPoints(from: Square, to: Square): string {
  const a = centre(from);
  const b = centre(to);
  const corner =
    Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  // Stop short of the centre so the arrowhead sits inside the target square.
  const dx = b.x - corner.x;
  const dy = b.y - corner.y;
  const length = Math.hypot(dx, dy) || 1;
  const end = { x: b.x - (dx / length) * 2.6, y: b.y - (dy / length) * 2.6 };
  return `${a.x},${a.y} ${corner.x},${corner.y} ${end.x},${end.y}`;
}

const FILES = "abcdefgh";

/**
 * A small static board for prompts and feedback (no pieces, no interaction): square marks,
 * square labels and knight routes. Plain SVG, so it renders on the server and scales cleanly.
 */
export default function DrillBoard({
  label,
  marks = {},
  labels = {},
  knightHops = [],
  coordinates = true,
  className,
}: DrillBoardProps) {
  const arrowId = `${useId()}-arrow`;
  const squares = Array.from({ length: 64 }, (_, index) => {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return `${FILES[file]}${rank + 1}`;
  });

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[10px] shadow-[0_1px_0_0_rgb(255_255_255/0.06)_inset,0_12px_32px_-12px_rgb(0_0_0/0.6)] ring-1 ring-border",
        className,
      )}
    >
      <svg viewBox="0 0 80 80" role="img" aria-label={label} className="block h-auto w-full">
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 4 4"
            refX="1.2"
            refY="2"
            markerWidth="2.6"
            markerHeight="2.6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L4,2 L0,4 Z" fill={boardTheme.arrow} />
          </marker>
        </defs>
        {squares.map((square) => {
          const { x, y, light } = origin(square);
          const mark = marks[square];
          return (
            <g key={square} data-square={square} data-mark={mark}>
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill={light ? boardTheme.light : boardTheme.dark}
              />
              {mark ? <rect x={x} y={y} width={CELL} height={CELL} fill={MARK_FILL[mark]} /> : null}
              {mark === "missed" ? (
                <rect
                  x={x + 0.9}
                  y={y + 0.9}
                  width={CELL - 1.8}
                  height={CELL - 1.8}
                  rx="1"
                  fill="none"
                  stroke={boardTheme.arrow}
                  strokeWidth="0.8"
                  strokeDasharray="1.6 1.1"
                />
              ) : null}
              {mark === "wrong" ? (
                <path
                  d={`M${x + 3},${y + 3} L${x + 7},${y + 7} M${x + 7},${y + 3} L${x + 3},${y + 7}`}
                  stroke={WRONG_STROKE}
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              ) : null}
            </g>
          );
        })}

        {coordinates
          ? Array.from({ length: 8 }, (_, index) => {
              // a1 is dark, so file letters on rank 1 and rank numbers on the a-file alternate.
              const fileInk = index % 2 === 0 ? INK_ON_DARK : INK_ON_LIGHT;
              const rankInk = index % 2 === 0 ? INK_ON_DARK : INK_ON_LIGHT;
              return (
                <g
                  key={index}
                  aria-hidden="true"
                  className="font-mono"
                  fontSize="2.5"
                  fontWeight="500"
                >
                  <text x={index * CELL + CELL - 1} y={78.7} textAnchor="end" fill={fileInk}>
                    {FILES[index]}
                  </text>
                  <text x={1} y={(7 - index) * CELL + 3} fill={rankInk}>
                    {index + 1}
                  </text>
                </g>
              );
            })
          : null}

        {knightHops.map(([from, to], index) => (
          <polyline
            key={`${from}-${to}-${index}`}
            points={hopPoints(from, to)}
            fill="none"
            stroke={boardTheme.arrow}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
            markerEnd={`url(#${arrowId})`}
          />
        ))}

        {Object.entries(labels).map(([square, text]) => {
          if (!text) return null;
          const { x, y } = centre(square);
          return (
            <g key={square} aria-hidden="true">
              <circle cx={x} cy={y} r="3.4" fill="#0b1220" opacity="0.82" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={text.length > 1 ? "3" : "3.6"}
                fontWeight="600"
                fill={INK_ON_DARK}
                className="font-mono"
              >
                {text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
