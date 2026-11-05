import { cn } from "@b2c-template/ui/lib/utils";
import {
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import type { GuideDiagram as GuideDiagramData } from "../lib/guide-content";
import { parseSquare } from "../lib/squares";

/** Midnight board squares, matching the main board. */
const LIGHT_SQUARE = "#8fa3c4";
const DARK_SQUARE = "#3d5278";
const FILES = "abcdefgh";

/** Square size in viewBox units. */
const CELL = 10;
const BOARD = CELL * 8;
/** Room for the rank labels on the left and the file labels underneath. */
const GUTTER = 6;

const PIECE_ICONS: Record<string, LucideIcon> = {
  k: ChessKing,
  q: ChessQueen,
  r: ChessRook,
  b: ChessBishop,
  n: ChessKnight,
  p: ChessPawn,
};

export type GuideDiagramProps = {
  diagram: GuideDiagramData;
  /** Show a-h and 1-8 along the edges; defaults to true. */
  showLabels?: boolean;
  /** Show the caption under the board; defaults to true. It is the board's accessible name either way. */
  showCaption?: boolean;
  className?: string;
};

/** Top-left corner of a square in viewBox units, White at the bottom. */
function cornerOf(square: string): { x: number; y: number } | null {
  const coords = parseSquare(square);
  if (!coords) return null;
  return { x: coords.file * CELL, y: (7 - coords.rank) * CELL };
}

function centreOf(square: string): { x: number; y: number } | null {
  const corner = cornerOf(square);
  return corner ? { x: corner.x + CELL / 2, y: corner.y + CELL / 2 } : null;
}

/** A small static board (pure SVG): highlighted squares, arrows and pieces, with a caption. */
export default function GuideDiagram({
  diagram,
  showLabels = true,
  showCaption = true,
  className,
}: GuideDiagramProps) {
  const markerId = `guide-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const offset = showLabels ? GUTTER : 0;
  const size = BOARD + offset;
  const occupied = new Set((diagram.pieces ?? []).map((piece) => piece.square));

  return (
    <figure className={cn("flex flex-col gap-2.5", className)}>
      <svg
        role="img"
        aria-label={diagram.caption}
        viewBox={`${-offset} 0 ${size} ${size}`}
        className="block h-auto w-full select-none"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="3.2"
            markerHeight="3.2"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" className="fill-primary" />
          </marker>
        </defs>

        <g>
          {Array.from({ length: 64 }, (_, index) => {
            const file = index % 8;
            const rankFromTop = Math.floor(index / 8);
            const dark = (file + (7 - rankFromTop)) % 2 === 0;
            return (
              <rect
                key={index}
                x={file * CELL}
                y={rankFromTop * CELL}
                width={CELL}
                height={CELL}
                fill={dark ? DARK_SQUARE : LIGHT_SQUARE}
              />
            );
          })}
        </g>

        <g>
          {(diagram.highlights ?? []).map((square) => {
            const corner = cornerOf(square);
            if (!corner) return null;
            return (
              <rect
                key={square}
                x={corner.x + 0.6}
                y={corner.y + 0.6}
                width={CELL - 1.2}
                height={CELL - 1.2}
                rx={1.2}
                className="fill-primary/50 stroke-primary"
                strokeWidth={1.2}
              />
            );
          })}
        </g>

        <g>
          {(diagram.pieces ?? []).map(({ square, piece }) => {
            const corner = cornerOf(square);
            const Icon = PIECE_ICONS[piece.toLowerCase()];
            if (!corner || !Icon) return null;
            const white = piece === piece.toUpperCase();
            const inset = 0.9;
            return (
              <Icon
                key={square}
                x={corner.x + inset}
                y={corner.y + inset}
                width={CELL - inset * 2}
                height={CELL - inset * 2}
                fill={white ? "#f8fafd" : "#0b1220"}
                stroke="#0b1220"
                strokeWidth={white ? 1.5 : 2.25}
                strokeLinejoin="round"
                aria-hidden
              />
            );
          })}
        </g>

        <g>
          {(diagram.arrows ?? []).map(({ from, to }) => {
            const start = centreOf(from);
            const end = centreOf(to);
            if (!start || !end) return null;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy);
            // Stop short so the head sits inside the target square, clear of any piece on it.
            const trim = Math.min(occupied.has(to) ? 4.4 : 2.6, length / 2);
            const x2 = end.x - (dx / length) * trim;
            const y2 = end.y - (dy / length) * trim;
            return (
              <line
                key={`${from}-${to}`}
                x1={start.x}
                y1={start.y}
                x2={x2}
                y2={y2}
                className="stroke-primary"
                strokeOpacity={0.92}
                strokeWidth={1.5}
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
        </g>

        {showLabels ? (
          <g className="fill-muted-foreground font-mono" fontSize={3.6} aria-hidden>
            {Array.from(FILES, (letter, file) => (
              <text
                key={letter}
                x={file * CELL + CELL / 2}
                y={BOARD + GUTTER - 1.4}
                textAnchor="middle"
              >
                {letter}
              </text>
            ))}
            {Array.from({ length: 8 }, (_, rank) => (
              <text
                key={rank}
                x={-GUTTER / 2}
                y={(7 - rank) * CELL + CELL / 2}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {rank + 1}
              </text>
            ))}
          </g>
        ) : null}
      </svg>
      {showCaption ? (
        <figcaption className="text-[13px] leading-snug text-pretty text-muted-foreground">
          {diagram.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
