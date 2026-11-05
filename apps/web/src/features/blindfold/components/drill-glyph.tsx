import { cn } from "@b2c-template/ui/lib/utils";
import type { ReactNode } from "react";

import { boardTheme } from "@/shared/components/board/board-theme";

import type { DrillKind } from "../lib/questions";

/** The glyphs draw on a 4x4 corner of a board; one unit is one square, (0, 0) the top left. */
const SIZE = 4;

/** Square centre on the 4x4 grid. */
const c = (index: number) => index + 0.5;

function Squares({ dim = false }: { dim?: boolean }) {
  return (
    <g>
      {Array.from({ length: SIZE * SIZE }, (_, index) => {
        const file = index % SIZE;
        const row = Math.floor(index / SIZE);
        // The bottom-left square of the corner is a1, which is dark.
        const light = (file + SIZE - 1 - row) % 2 === 1;
        return (
          <rect
            key={index}
            x={file}
            y={row}
            width={1}
            height={1}
            fill={light ? boardTheme.light : boardTheme.dark}
            opacity={light ? (dim ? 0.26 : 0.4) : dim ? 0.5 : 0.75}
          />
        );
      })}
    </g>
  );
}

/** A small king, drawn in a unit square at (x, y). */
function King({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(0.1)`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 1.2v2.6M3.9 2.3h2.2" />
      <path
        d="M2.6 8.2c-.6-2.4.6-4.1 2.4-4.1s3 1.7 2.4 4.1z"
        fill="currentColor"
        fillOpacity={0.25}
      />
      <path d="M2.3 8.9h5.4" />
    </g>
  );
}

const ACCENT = "currentColor";

const GLYPHS: Record<DrillKind, ReactNode> = {
  // One square framed: light or dark?
  square_colour: (
    <>
      <Squares dim />
      <path d="M1 1h2L1 3z" fill={boardTheme.light} />
      <path d="M3 1v2H1z" fill={boardTheme.dark} />
      <rect
        x={1}
        y={1}
        width={2}
        height={2}
        rx={0.1}
        fill="none"
        stroke={ACCENT}
        strokeWidth={0.12}
      />
    </>
  ),
  // One highlighted square on a board without labels.
  coordinates: (
    <>
      <Squares dim />
      <rect x={2} y={1} width={1} height={1} fill={ACCENT} opacity={0.9} />
      <path
        d={`M${c(2)} 0v0.7M${c(2)} 2.3V4M0 ${c(1)}h1.7M3.3 ${c(1)}H4`}
        stroke={ACCENT}
        strokeWidth={0.06}
        strokeDasharray="0.12 0.12"
        opacity={0.7}
      />
    </>
  ),
  // A full diagonal lit, corner to corner.
  diagonals: (
    <>
      <Squares dim />
      {[0, 1, 2, 3].map((index) => (
        <rect
          key={index}
          x={index}
          y={3 - index}
          width={1}
          height={1}
          fill={ACCENT}
          opacity={index === 1 ? 0.95 : 0.4}
        />
      ))}
      <path d="M0.2 3.8 3.8 0.2" stroke={ACCENT} strokeWidth={0.08} strokeLinecap="round" />
    </>
  ),
  // Two squares, one bishop line between them.
  same_diagonal: (
    <>
      <Squares dim />
      <path
        d={`M${c(0)} ${c(3)}L${c(3)} ${c(0)}`}
        stroke={ACCENT}
        strokeWidth={0.08}
        strokeDasharray="0.16 0.12"
        strokeLinecap="round"
      />
      <circle cx={c(0)} cy={c(3)} r={0.28} fill={ACCENT} />
      <circle cx={c(3)} cy={c(0)} r={0.28} fill="none" stroke={ACCENT} strokeWidth={0.12} />
    </>
  ),
  // Two knight hops, from start to target: count the moves.
  knight_distance: (
    <>
      <Squares dim />
      <rect x={1} y={1} width={1} height={1} fill={ACCENT} opacity={0.3} />
      <rect x={3} y={0} width={1} height={1} fill={ACCENT} opacity={0.3} />
      <path
        d={`M${c(0)} ${c(3)}V${c(1)}H${c(1)}`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={0.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${c(1)} ${c(1)}H${c(3)}V${c(0)}`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={0.08}
        strokeDasharray="0.12 0.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
      <circle cx={c(0)} cy={c(3)} r={0.2} fill={ACCENT} />
      <circle cx={c(1)} cy={c(1)} r={0.12} fill={ACCENT} />
      <circle cx={c(3)} cy={c(0)} r={0.24} fill="none" stroke={ACCENT} strokeWidth={0.1} />
    </>
  ),
  // A king on the receiving end of a bishop's ray.
  check_detection: (
    <>
      <Squares dim />
      <rect x={1} y={1} width={1} height={1} fill={ACCENT} opacity={0.28} />
      <path
        d={`M${c(3)} ${c(3)}L${c(1) + 0.32} ${c(1) + 0.32}`}
        stroke={ACCENT}
        strokeWidth={0.1}
        strokeLinecap="round"
      />
      <circle cx={c(3)} cy={c(3)} r={0.2} fill={ACCENT} />
      <King x={1} y={1} className="text-foreground" />
    </>
  ),
  // Numbered moves: a sequence to hold in your head.
  position_recall: (
    <>
      <Squares dim />
      <path
        d={`M${c(0)} ${c(3)}L${c(1)} ${c(1)}L${c(3)} ${c(2)}`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={0.06}
        strokeDasharray="0.1 0.1"
        opacity={0.7}
      />
      {(
        [
          [0, 3, "1"],
          [1, 1, "2"],
          [3, 2, "3"],
        ] as const
      ).map(([file, rank, label], index) => (
        <g key={label}>
          <circle
            cx={c(file)}
            cy={c(rank)}
            r={0.36}
            fill={index === 2 ? ACCENT : "#0b1220"}
            stroke={ACCENT}
            strokeWidth={0.08}
          />
          <text
            x={c(file)}
            y={c(rank) + 0.17}
            textAnchor="middle"
            fontSize={0.48}
            fontWeight={600}
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            fill={index === 2 ? "#04231a" : ACCENT}
          >
            {label}
          </text>
        </g>
      ))}
    </>
  ),
  // A back-rank mate: the rook sweeps the rank, the pawns block every flight square.
  mate_in_one: (
    <>
      <Squares dim />
      <rect x={2} y={0} width={1} height={1} fill={ACCENT} opacity={0.9} />
      <path d={`M${c(0)} ${c(0)}H1.9`} stroke={ACCENT} strokeWidth={0.1} strokeLinecap="round" />
      <circle cx={c(0)} cy={c(0)} r={0.2} fill={ACCENT} />
      {[1, 2, 3].map((file) => (
        <circle key={file} cx={c(file)} cy={c(1)} r={0.13} fill="currentColor" opacity={0.55} />
      ))}
      <King x={2} y={0} className="text-primary-foreground" />
    </>
  ),
};

/** A tiny board motif that identifies a drill at a glance (decorative). */
export default function DrillGlyph({ kind, className }: { kind: DrillKind; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      focusable="false"
      className={cn("size-12 shrink-0 overflow-hidden rounded-lg text-primary", className)}
      shapeRendering="geometricPrecision"
    >
      {GLYPHS[kind]}
    </svg>
  );
}
